import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type CastInput = { id?: string; name: string; role?: string };

type StartInput = {
  topic: string;
  notes?: string;
  youtubeUrl?: string;
  cast: CastInput[];
  episodeCount?: number;
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

const GRADIENTS = [
  "from-violet-500/30 via-fuchsia-500/20 to-transparent",
  "from-indigo-500/30 via-purple-500/20 to-transparent",
  "from-purple-500/30 via-rose-500/20 to-transparent",
  "from-sky-500/30 via-violet-500/20 to-transparent",
];

function castLine(cast: CastInput[]) {
  if (!cast.length) return "No named cast — use a single friendly narrator.";
  return cast.map((c) => `${c.name}${c.role ? ` (${c.role})` : ""}`).join(", ");
}

/** Plans the series: writes the series row, the job row and one episode shell per planned episode. */
export const startGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: StartInput) => input)
  .handler(async ({ data, context }) => {
    const { chat, parseJson } = await import("./ai.server");
    const { supabase, userId } = context;
    const count = Math.min(8, Math.max(3, data.episodeCount ?? 5));

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
            content: [
              `Topic of study: ${data.topic}`,
              data.notes ? `Student's study material:\n${data.notes.slice(0, 12000)}` : "",
              data.youtubeUrl ? `Reference video link: ${data.youtubeUrl}` : "",
              `Cast who act out the lessons: ${castLine(data.cast)}`,
              `Plan exactly ${count} episodes.`,
            ]
              .filter(Boolean)
              .join("\n\n"),
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

    const characterIds = data.cast.map((c) => c.id).filter((id): id is string => Boolean(id));
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
            ? { owner_id: userId, series_id: series.id, kind: "youtube", source_url: data.youtubeUrl }
            : null,
        ].filter((row): row is NonNullable<typeof row> => row !== null),
      );
    }

    const { data: job, error: jobError } = await supabase
      .from("generation_jobs")
      .insert({
        owner_id: userId,
        series_id: series.id,
        status: "running",
        stage: "Storyboarding the series",
        progress: 8,
        episode_titles: episodes.map((e) => e.title),
      })
      .select("id")
      .single();
    if (jobError || !job) throw new Error(jobError?.message ?? "Could not start the generation job.");

    return {
      jobId: job.id,
      seriesId: series.id,
      title: outline.title || data.topic,
      episodeTitles: episodes.map((e) => e.title),
    };
  });

/** Writes the slides and quiz for one episode, then advances the job. */
export const buildEpisode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { jobId: string; index: number; topic: string; cast: CastInput[] }) => input)
  .handler(async ({ data, context }) => {
    const { chat, parseJson } = await import("./ai.server");
    const { supabase, userId } = context;

    const { data: job } = await supabase
      .from("generation_jobs")
      .select("id, series_id, episode_titles, episodes_done")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job?.series_id) throw new Error("That generation job is gone.");

    const titles = Array.isArray(job.episode_titles) ? (job.episode_titles as string[]) : [];
    const total = titles.length || 1;

    const { data: episode } = await supabase
      .from("episodes")
      .select("id, title, synopsis")
      .eq("series_id", job.series_id)
      .eq("order_index", data.index)
      .maybeSingle();
    if (!episode) throw new Error("That episode is missing.");

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
            content: [
              `Series topic: ${data.topic}`,
              `Episode ${data.index + 1} of ${total}: ${episode.title}`,
              episode.synopsis ? `Synopsis: ${episode.synopsis}` : "",
              `Cast acting it out: ${castLine(data.cast)}`,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
        { json: true },
      ),
    );

    const slides = (content.slides ?? []).slice(0, 8);
    if (slides.length) {
      await supabase.from("episode_slides").insert(
        slides.map((s, i) => ({
          episode_id: episode.id,
          order_index: i,
          title: s.title,
          bullets: (s.bullets ?? []).filter((b) => typeof b === "string"),
          takeaway: s.takeaway ?? null,
        })),
      );
    }

    const questions = (content.questions ?? []).slice(0, 5);
    if (questions.length) {
      await supabase.from("episode_questions").insert(
        questions.map((q, i) => {
          const written = q.kind === "written" || !q.options?.length;
          return {
            episode_id: episode.id,
            order_index: i,
            kind: written ? "written" : "mcq",
            prompt: q.prompt,
            options: written ? [] : (q.options ?? []),
            correct_index: written ? null : (q.correct_index ?? 0),
            answer_text: written ? (q.answer_text ?? "") : null,
            explanation: q.explanation ?? "",
            seconds: q.seconds && q.seconds >= 10 ? Math.min(60, q.seconds) : written ? 30 : 20,
          };
        }),
      );
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
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("owner_id", userId);

    if (complete) {
      await supabase.from("series").update({ status: "ready" }).eq("id", job.series_id);
    }

    return { index: data.index, title: episode.title, done, total, complete, seriesId: job.series_id };
  });
