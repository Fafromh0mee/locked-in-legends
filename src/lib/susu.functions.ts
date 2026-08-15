import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SUSU_SYSTEM = [
  "You are Susu, a warm, encouraging study coach inside the Studly learning app.",
  "Academic integrity is non-negotiable: never hand over finished graded work, essays, or full answer keys.",
  "Coach instead — give hints, ask Socratic questions, explain the underlying idea, and walk through a similar worked example.",
  "If a student asks you to just give the answer to graded work, kindly refuse and offer the next hint instead.",
  "Keep replies short and readable. Use short paragraphs, and markdown bullets (- ) or numbered steps when listing things.",
  "Use **bold** sparingly for key terms. Never use markdown headings or tables.",
].join(" ");

const DECK_SYSTEM =
  'You write study flashcards. Reply with JSON only: {"title":string,"cards":[{"front":string,"back":string}]} — ' +
  "8 to 14 cards. Fronts are short prompts; backs are concise answers of at most two sentences. No markdown.";

type AskInput = {
  question: string;
  context?: string;
  history?: { role: "user" | "assistant"; content: string }[];
};

const DECK_HINT = /(flash\s?cards?|flashcard deck|deck of cards|study cards|revision cards)/i;

export const askSusu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AskInput) => input)
  .handler(async ({ data }) => {
    const { chat } = await import("./ai.server");
    const { parseJson } = await import("./ai.server");
    const wantsDeck = DECK_HINT.test(data.question);

    let deck: { title: string; cards: { front: string; back: string }[] } | null = null;
    if (wantsDeck) {
      try {
        const raw = await chat(
          [
            { role: "system", content: DECK_SYSTEM },
            ...(data.context ? [{ role: "system" as const, content: `Lesson context:\n${data.context}` }] : []),
            { role: "user", content: data.question },
          ],
          { json: true },
        );
        const parsed = parseJson<{ title?: string; cards?: { front: string; back: string }[] }>(raw);
        const cards = (parsed.cards ?? [])
          .filter((c) => c?.front && c?.back)
          .slice(0, 14)
          .map((c) => ({ front: String(c.front).trim(), back: String(c.back).trim() }));
        if (cards.length >= 3) deck = { title: (parsed.title ?? "Flashcard deck").slice(0, 80), cards };
      } catch {
        deck = null;
      }
    }

    const reply = await chat([
      { role: "system", content: SUSU_SYSTEM },
      ...(data.context ? [{ role: "system" as const, content: `Lesson context:\n${data.context}` }] : []),
      ...(deck
        ? [
            {
              role: "system" as const,
              content:
                `You have already prepared a ${deck.cards.length}-card deck called "${deck.title}", shown to the student ` +
                "below your message with a button to add it to their Flashcards tab. Introduce it in one or two sentences " +
                "and add one quick study tip. Do not list the cards.",
            },
          ]
        : []),
      ...(data.history ?? []).slice(-10),
      { role: "user", content: data.question },
    ]);

    let followUps: string[] = [];
    try {
      const raw = await chat(
        [
          {
            role: "system",
            content:
              'Reply with JSON only: {"follow_ups":[string,string,string]} — three short questions the student could ask next.',
          },
          { role: "user", content: `Student asked: ${data.question}\nSusu answered: ${reply}` },
        ],
        { json: true },
      );
      followUps = parseJson<{ follow_ups?: string[] }>(raw).follow_ups?.slice(0, 3) ?? [];
    } catch {
      followUps = [];
    }

    return { reply, followUps, deck };
  });
