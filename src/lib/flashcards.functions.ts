import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GeneratedCard = { front: string; back: string };

type GenerateInput = { seriesId?: string; prompt?: string; count?: number };
type SaveInput = { title: string; topic?: string | null; source?: string; cards: GeneratedCard[] };

const generatedCardSchema = z.object({
  front: z.string().trim().min(1).max(500),
  back: z.string().trim().min(1).max(1_000),
});

const generateSchema = z.object({
  seriesId: z.string().uuid().optional(),
  prompt: z.string().trim().max(4_000).optional(),
  count: z.number().int().min(4).max(24).optional(),
});

const saveSchema = z.object({
  title: z.string().trim().min(1).max(80),
  topic: z.string().trim().max(200).nullable().optional(),
  source: z.string().trim().max(40).optional(),
  cards: z.array(generatedCardSchema).min(1).max(40),
});

const DECK_SYSTEM =
  'You write study flashcards. Reply with JSON only: {"title":string,"cards":[{"front":string,"back":string}]}. ' +
  "Fronts are short prompts or questions; backs are concise answers (max 2 sentences). No markdown, no numbering.";

export const generateDeck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => generateSchema.parse(input) as GenerateInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const count = Math.min(Math.max(data.count ?? 12, 4), 24);

    let sourceText = data.prompt?.trim() ?? "";
    let topic = data.prompt?.trim() ?? null;
    let source = "prompt";

    if (data.seriesId) {
      const { data: series } = await supabase
        .from("series")
        .select("id, title, topic, description")
        .eq("id", data.seriesId)
        .maybeSingle();
      if (!series) throw new Error("That series could not be found.");

      const { data: episodes } = await supabase
        .from("episodes")
        .select("id, title, synopsis")
        .eq("series_id", data.seriesId)
        .order("order_index", { ascending: true });

      const ids = (episodes ?? []).map((e) => e.id);
      const { data: slides } = ids.length
        ? await supabase.from("episode_slides").select("title, bullets, takeaway").in("episode_id", ids)
        : { data: [] as { title: string; bullets: unknown; takeaway: string | null }[] };

      const slideText = (slides ?? [])
        .map((s) => {
          const bullets = Array.isArray(s.bullets) ? (s.bullets as unknown[]).map(String).join("; ") : "";
          return `${s.title}: ${bullets}${s.takeaway ? ` Takeaway: ${s.takeaway}` : ""}`;
        })
        .join("\n");

      topic = series.topic ?? series.title;
      source = "series";
      sourceText = [
        `Series: ${series.title}`,
        series.description ?? "",
        (episodes ?? []).map((e) => `Episode: ${e.title} — ${e.synopsis ?? ""}`).join("\n"),
        slideText,
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 12000);
    }

    if (!sourceText) throw new Error("Pick a series or write a prompt first.");

    const { chat, parseJson } = await import("./ai.server");
    const raw = await chat(
      [
        { role: "system", content: DECK_SYSTEM },
        { role: "user", content: `Make ${count} flashcards from this material:\n\n${sourceText}` },
      ],
      { json: true },
    );

    const parsed = parseJson<{ title?: string; cards?: GeneratedCard[] }>(raw);
    const cards = (parsed.cards ?? [])
      .filter((c) => c?.front && c?.back)
      .slice(0, count)
      .map((c) => ({ front: String(c.front).trim(), back: String(c.back).trim() }));
    if (cards.length === 0) throw new Error("The deck came back empty. Try again.");

    const title = (parsed.title ?? topic ?? "Flashcard deck").toString().slice(0, 80);

    const { data: deck, error } = await supabase
      .from("flashcard_decks")
      .insert({ owner_id: userId, title, topic, source })
      .select("id")
      .single();
    if (error) throw error;

    const { error: cardError } = await supabase.from("flashcards").insert(
      cards.map((c, i) => ({ deck_id: deck.id, owner_id: userId, front: c.front, back: c.back, order_index: i })),
    );
    if (cardError) throw cardError;

    return { deckId: deck.id, title, count: cards.length };
  });

export const saveDeck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveSchema.parse(input) as SaveInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const cards = (data.cards ?? []).filter((c) => c?.front && c?.back).slice(0, 40);
    if (cards.length === 0) throw new Error("There are no cards to save.");

    const { data: deck, error } = await supabase
      .from("flashcard_decks")
      .insert({
        owner_id: userId,
        title: data.title.slice(0, 80) || "Flashcard deck",
        topic: data.topic ?? null,
        source: data.source ?? "susu",
      })
      .select("id")
      .single();
    if (error) throw error;

    const { error: cardError } = await supabase.from("flashcards").insert(
      cards.map((c, i) => ({
        deck_id: deck.id,
        owner_id: userId,
        front: String(c.front).trim(),
        back: String(c.back).trim(),
        order_index: i,
      })),
    );
    if (cardError) throw cardError;

    return { deckId: deck.id, count: cards.length };
  });
