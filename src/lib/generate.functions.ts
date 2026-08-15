import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";

import type { ChatMessage } from "./ai.server";

type AppSupabase = SupabaseClient<Database>;

type CastInput = {
  id?: string;
  name: string;
  role?: string;
  imageUrls?: string[];
};

type StartInput = {
  topic: string;
  notes?: string;
  youtubeUrl?: string;
  cast: CastInput[];
  episodeCount?: number;
};

type BuildInput = {
  jobId: string;
  index: number;
  topic?: string;
  cast?: CastInput[];
};

type StoredGenerationContext = {
  topic: string;
  notes?: string;
  youtubeUrl?: string;
  youtubeTitle?: string | null;
  youtubeTranscript?: string | null;
  cast: CastInput[];
};

type Outline = {
  title: string;
  description: string;
  subject?: string;
  episodes: { title: string; synopsis: string }[];
};

type EpisodeContent = {
  slides: { title: string; bullets: string[]; takeaway: string }[];
  questions: {
    kind: "mcq" | "written";
    prompt: string;
    options?: string[];
    correct_index?: number;
    answer_text?: string;
    explanation: string;
    seconds?: number;
  }[];
};

const castSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  role: z.string().trim().max(160).optional(),
  imageUrls: z.array(z.string().url()).max(4).optional(),
});

const startSchema = z.object({
  topic: z.string().trim().min(2).max(200),
  notes: z.string().trim().max(20_000).optional(),
  youtubeUrl: z.string().trim().max(500).optional(),
  cast: z.array(castSchema).max(8).default([]),
  episodeCount: z.number().int().min(3).max(8).optional(),
});

const buildSchema = z.object({
  jobId: z.string().uuid(),
  index: z.number().int().min(0).max(7),
  topic: z.string().trim().max(200).optional(),
  cast: z.array(castSchema).max(8).optional(),
});

const GRADIENTS = [
  "from-violet-500/30 via-fuchsia-500/20 to-transparent",
  "from-indigo-500/30 via-purple-500/20 to-transparent",
  "from-purple-500/30 via-rose-500/20 to-transparent",
  "from-sky-500/30 via-violet-500/20 to-transparent",
];

function castLine(cast: CastInput[]) {
  if (!cast.length) return "No named cast; use a single friendly narrator.";
  return cast
    .map((c) => {
      const photos = c.imageUrls?.length ? `, ${c.imageUrls.length} reference photo(s)` : "";
      return `${c.name}${c.role ? ` (${c.role})` : ""}${photos}`;
    })
    .join(", ");
}

function promptWithCastReferences(text: string, cast: CastInput[]): ChatMessage["content"] {
  const imageUrls = cast.flatMap((c) => c.imageUrls ?? []).slice(0, 10);
  if (imageUrls.length === 0) return text;

  const parts: Exclude<ChatMessage["content"], string> = [
    {
      type: "text",
      text:
        `${text}\n\nReference photos are attached for cast visual consistency only. ` +
        "Use them to keep character appearance stable; do not make quiz questions about the photos.",
    },
  ];
  for (const url of imageUrls) parts.push({ type: "image_url", image_url: { url } });
  return parts;
}

async function resolveCast(supabase: AppSupabase, userId: string, cast: CastInput[]) {
  const normalized = cast
    .map((c) => ({
      ...c,
      name: c.name.trim(),
      role: c.role?.trim() || undefined,
      imageUrls: [...new Set((c.imageUrls ?? []).filter(Boolean))].slice(0, 4),
    }))
    .filter((c) => c.name);

  const ids = normalized.map((c) => c.id).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return normalized;

  const { data } = await supabase
    .from("characters")
    .select("id, name, role_description, image_urls")
    .eq("owner_id", userId)
    .in("id", ids);

  const byId = new Map((data ?? []).map((row) => [row.id, row]));
  return normalized.map((castMember) => {
    const saved = castMember.id ? byId.get(castMember.id) : null;
    const imageUrls = [...new Set([...(saved?.image_urls ?? []), ...(castMember.imageUrls ?? [])])].slice(0, 4);
    return {
      id: castMember.id,
      name: saved?.name ?? castMember.name,
      role: saved?.role_description ?? castMember.role,
      imageUrls,
    };
  });
}

function studyMaterialPrompt(data: StartInput, youtube: { title: string | null; transcript: string | null } | null) {
  return [
    data.notes ? `Student's study material:\n${data.notes.slice(0, 12_000)}` : "",
    youtube?.transcript
      ? [
          `Reference video transcript${youtube.title ? ` (${youtube.title})` : ""}:`,
          youtube.transcript.slice(0, 12_000),
        ].join("\n")
      : data.youtubeUrl
        ? `Reference video link${youtube?.title ? ` (${youtube.title})` : ""}: ${data.youtubeUrl}`
        : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function readStoredContext(value: Json | null | undefined): Partial<StoredGenerationContext> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as unknown as Partial<StoredGenerationContext>;
}

async function markGenerationFailed(
  supabase: AppSupabase,
  jobId: string,
  seriesId: string | null,
  episodeId: string | null,
  message: string,
) {
  await supabase
    .from("generation_jobs")
    .update({ status: "failed", stage: "Generation paused", error: message, updated_at: new Date().toISOString() })
    .eq("id", jobId);
  if (seriesId) await supabase.from("series").update({ status: "failed" }).eq("id", seriesId);
  if (episodeId) await supabase.from("episodes").update({ status: "failed" }).eq("id", episodeId);
}

/** Plans the series: writes the series row, the job row and one episode shell per planned episode. */
export const startGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => startSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { chat, parseJson } = await import("./ai.server");
    const { getYouTubeContext } = await import("./youtube.server");
    const { supabase, userId } = context;
    const count = Math.min(8, Math.max(3, data.episodeCount ?? 5));
    const cast = await resolveCast(supabase, userId, data.cast);
    const youtube = data.youtubeUrl ? await getYouTubeContext(data.youtubeUrl) : null;

    const outline = parseJson<Outline>(
      await chat(
        [
          {
            role: "system",
            content:
              "You are a curriculum designer for a cinematic learning app. Reply with JSON only: " +
              '{"title":string,"description":string,"subject":string,"episodes":[{"title":string,"synopsis":string}]}. ' +
              "Episodes must build on each other in a clear teaching order.",
          },
          {
            role: "user",
            content: promptWithCastReferences(
              [
                `Topic of study: ${data.topic}`,
                studyMaterialPrompt(data, youtube),
                `Cast who act out the lessons: ${castLine(cast)}`,
                `Plan exactly ${count} episodes.`,
              ]
                .filter(Boolean)
                .join("\n\n"),
              cast,
            ),
          },
        ],
        { json: true },
      ),
    );

    const episodes = (outline.episodes ?? []).slice(0, count);
    if (episodes.length === 0) throw new Error("The planner returned no episodes. Try again.");

    const { data: series, error: seriesError } = await supabase
      .from("series")
      .insert({
        owner_id: userId,
        title: outline.title || data.topic,
        description: outline.description ?? null,
        subject: outline.subject ?? null,
        topic: data.topic,
        status: "generating",
        is_public: false,
        episode_count: episodes.length,
        cover_gradient: GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)]!,
      })
      .select("id")
      .single();
    if (seriesError || !series) throw new Error(seriesError?.message ?? "Could not create the series.");

    const { error: epError } = await supabase.from("episodes").insert(
      episodes.map((ep, i) => ({
        owner_id: userId,
        series_id: series.id,
        order_index: i,
        title: ep.title,
        synopsis: ep.synopsis ?? null,
        status: "queued",
      })),
    );
    if (epError) throw new Error(epError.message);

    const characterIds = cast.map((c) => c.id).filter((id): id is string => Boolean(id));
    if (characterIds.length) {
      await supabase
        .from("series_characters")
        .insert(characterIds.map((character_id) => ({ series_id: series.id, character_id })));
    }

    if (data.notes || data.youtubeUrl) {
      await supabase.from("study_materials").insert(
        [
          data.notes ? { owner_id: userId, series_id: series.id, kind: "text", text_content: data.notes } : null,
          data.youtubeUrl
            ? {
                owner_id: userId,
                series_id: series.id,
                kind: "youtube",
                source_url: data.youtubeUrl,
                text_content: youtube?.transcript ?? youtube?.title ?? null,
              }
            : null,
        ].filter((row): row is NonNullable<typeof row> => row !== null),
      );
    }

    const inputContext: StoredGenerationContext = {
      topic: data.topic,
      ...(data.notes ? { notes: data.notes } : {}),
      ...(data.youtubeUrl ? { youtubeUrl: data.youtubeUrl } : {}),
      youtubeTitle: youtube?.title ?? null,
      youtubeTranscript: youtube?.transcript ?? null,
      cast,
    };

    const { data: job, error: jobError } = await supabase
      .from("generation_jobs")
      .insert({
        owner_id: userId,
        series_id: series.id,
        status: "running",
        stage: "Storyboarding the series",
        progress: 8,
        episode_titles: episodes.map((e) => e.title),
        input_context: inputContext as Json,
      })
      .select("id")
      .single();
    if (jobError || !job) throw new Error(jobError?.message ?? "Could not start the generation job.");

    return {
      jobId: job.id,
      seriesId: series.id,
      title: outline.title || data.topic,
      episodeTitles: episodes.map((e) => e.title),
      youtubeTranscriptAvailable: Boolean(youtube?.transcript),
    };
  });

/** Writes the slides and quiz for one episode, then advances the job. */
export const buildEpisode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => buildSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { chat, parseJson } = await import("./ai.server");
    const { supabase, userId } = context;

    const { data: job } = await supabase
      .from("generation_jobs")
      .select("id, series_id, episode_titles, episodes_done, input_context")
      .eq("id", data.jobId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!job?.series_id) throw new Error("That generation job is gone.");

    const stored = readStoredContext(job.input_context);
    const titles = Array.isArray(job.episode_titles) ? (job.episode_titles as string[]) : [];
    const total = titles.length || 1;
    const topic = data.topic?.trim() || stored.topic || "this topic";
    const cast = data.cast?.length
      ? await resolveCast(supabase, userId, data.cast)
      : Array.isArray(stored.cast)
        ? stored.cast
        : [];

    const { data: episode } = await supabase
      .from("episodes")
      .select("id, title, synopsis, status")
      .eq("series_id", job.series_id)
      .eq("order_index", data.index)
      .maybeSingle();
    if (!episode) throw new Error("That episode is missing.");

    const [{ count: slideCount }, { count: questionCount }] = await Promise.all([
      supabase.from("episode_slides").select("id", { count: "exact", head: true }).eq("episode_id", episode.id),
      supabase.from("episode_questions").select("id", { count: "exact", head: true }).eq("episode_id", episode.id),
    ]);

    if (episode.status === "ready" && (slideCount ?? 0) > 0 && (questionCount ?? 0) > 0) {
      const done = Math.max(job.episodes_done ?? 0, data.index + 1);
      const complete = done >= total;
      await supabase
        .from("generation_jobs")
        .update({
          episodes_done: done,
          progress: Math.round(8 + (done / total) * 92),
          stage: complete ? "Final cut delivered" : `Filming episode ${done + 1}`,
          status: complete ? "complete" : "running",
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .eq("owner_id", userId);
      if (complete) await supabase.from("series").update({ status: "ready" }).eq("id", job.series_id);
      return { index: data.index, title: episode.title, done, total, complete, seriesId: job.series_id };
    }

    await supabase.from("series").update({ status: "generating" }).eq("id", job.series_id);
    await supabase.from("episodes").update({ status: "generating" }).eq("id", episode.id);
    await supabase.from("generation_jobs").update({ status: "running", error: null }).eq("id", job.id).eq("owner_id", userId);
    await supabase.from("episode_slides").delete().eq("episode_id", episode.id);
    await supabase.from("episode_questions").delete().eq("episode_id", episode.id);

    try {
      const materialPrompt = studyMaterialPrompt(
        { topic, notes: stored.notes, youtubeUrl: stored.youtubeUrl, cast, episodeCount: total },
        { title: stored.youtubeTitle ?? null, transcript: stored.youtubeTranscript ?? null },
      );

      const content = parseJson<EpisodeContent>(
        await chat(
          [
            {
              role: "system",
              content:
                "You write cinematic teaching episodes. Reply with JSON only: " +
                '{"slides":[{"title":string,"bullets":[string,string,string],"takeaway":string}],' +
                '"questions":[{"kind":"mcq"|"written","prompt":string,"options":[string],"correct_index":number,"answer_text":string,"explanation":string,"seconds":number}]}. ' +
                "Give 5 slides with 3 substantive bullets each. Give exactly 3 questions: two mcq with 4 options and correct_index, " +
                "one written whose answer_text is a short 1-4 word answer. Every question needs a one-sentence explanation of the correct answer. " +
                "seconds is 20 for mcq and 30 for written. Reference the cast by name inside the slide narration where it helps. " +
                "Questions must be about the lesson content only: never mention, quote, or attribute answers to any cast member. " +
                "Do not phrase questions as 'According to <character>' or 'What did <character> say'. Ask about the topic itself.",
            },
            {
              role: "user",
              content: promptWithCastReferences(
                [
                  `Series topic: ${topic}`,
                  `Episode ${data.index + 1} of ${total}: ${episode.title}`,
                  episode.synopsis ? `Synopsis: ${episode.synopsis}` : "",
                  materialPrompt,
                  `Cast acting it out: ${castLine(cast)}`,
                ]
                  .filter(Boolean)
                  .join("\n\n"),
                cast,
              ),
            },
          ],
          { json: true },
        ),
      );

      const slides = (content.slides ?? []).slice(0, 8);
      if (slides.length) {
        const { error } = await supabase.from("episode_slides").insert(
          slides.map((s, i) => ({
            episode_id: episode.id,
            order_index: i,
            title: s.title,
            bullets: (s.bullets ?? []).filter((b) => typeof b === "string"),
            takeaway: s.takeaway ?? null,
          })),
        );
        if (error) throw error;
      }

      const questions = (content.questions ?? []).slice(0, 5);
      if (questions.length) {
        const { error } = await supabase.from("episode_questions").insert(
          questions.map((q, i) => {
            const written = q.kind === "written" || !q.options?.length;
            const options = (q.options ?? []).filter((option) => typeof option === "string").slice(0, 4);
            const correctIndex = Math.min(Math.max(q.correct_index ?? 0, 0), Math.max(options.length - 1, 0));
            return {
              episode_id: episode.id,
              order_index: i,
              kind: written ? "written" : "mcq",
              prompt: q.prompt,
              options: written ? [] : options,
              correct_index: written ? null : correctIndex,
              answer_text: written ? (q.answer_text ?? "") : null,
              explanation: q.explanation ?? "",
              seconds: q.seconds && q.seconds >= 10 ? Math.min(60, q.seconds) : written ? 30 : 20,
            };
          }),
        );
        if (error) throw error;
      }

      await supabase.from("episodes").update({ status: "ready" }).eq("id", episode.id);

      const done = data.index + 1;
      const complete = done >= total;
      await supabase
        .from("generation_jobs")
        .update({
          episodes_done: done,
          progress: Math.round(8 + (done / total) * 92),
          stage: complete ? "Final cut delivered" : `Filming episode ${done + 1}`,
          status: complete ? "complete" : "running",
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .eq("owner_id", userId);

      if (complete) {
        await supabase.from("series").update({ status: "ready" }).eq("id", job.series_id);
      }

      return { index: data.index, title: episode.title, done, total, complete, seriesId: job.series_id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Episode generation failed.";
      await markGenerationFailed(supabase, job.id, job.series_id, episode.id, message);
      throw new Error(message);
    }
  });
