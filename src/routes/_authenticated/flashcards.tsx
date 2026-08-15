import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Layers, Loader2, RotateCcw, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Ambience } from "@/components/motion/Ambience";
import { Reveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { generateDeck } from "@/lib/flashcards.functions";
import { pop } from "@/lib/learning";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/flashcards")({
  head: () => ({
    meta: [
      { title: "Flashcards — AI decks you can flip through | Studly" },
      {
        name: "description",
        content:
          "Generate flashcard decks from any Studly series or your own prompt, then study them with interactive flip cards.",
      },
      { property: "og:title", content: "Studly flashcards" },
      { property: "og:description", content: "AI-built decks from your series or a prompt, with interactive flip cards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FlashcardsPage,
});

type Card = { id: string; front: string; back: string; known: boolean; reviews: number; order_index: number };

function FlashcardsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const generate = useServerFn(generateDeck);
  const [prompt, setPrompt] = useState("");
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [studyDeck, setStudyDeck] = useState<string | null>(null);

  const { data: series } = useQuery({
    queryKey: ["flashcards-series"],
    queryFn: async () => {
      const { data } = await supabase
        .from("series")
        .select("id, title, subject")
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  const { data: decks } = useQuery({
    queryKey: ["flashcard-decks", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("flashcard_decks")
        .select("id, title, topic, source, created_at")
        .order("created_at", { ascending: false });
      if (!data?.length) return [];
      const { data: cards } = await supabase.from("flashcards").select("deck_id, known").in(
        "deck_id",
        data.map((d) => d.id),
      );
      return data.map((d) => {
        const own = (cards ?? []).filter((c) => c.deck_id === d.id);
        return { ...d, total: own.length, known: own.filter((c) => c.known).length };
      });
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!seriesId && !prompt.trim()) throw new Error("Pick a series or write a prompt first.");
      return generate({ data: seriesId ? { seriesId } : { prompt: prompt.trim() } });
    },
    onSuccess: async (res) => {
      setPrompt("");
      setSeriesId(null);
      await queryClient.invalidateQueries({ queryKey: ["flashcard-decks", user?.id] });
      toast.success(`“${res.title}” is ready — ${res.count} cards.`);
      setStudyDeck(res.deckId);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "The deck could not be built."),
  });

  async function removeDeck(id: string) {
    await supabase.from("flashcard_decks").delete().eq("id", id);
    if (studyDeck === id) setStudyDeck(null);
    await queryClient.invalidateQueries({ queryKey: ["flashcard-decks", user?.id] });
  }

  if (studyDeck) {
    return <StudyView deckId={studyDeck} onExit={() => setStudyDeck(null)} />;
  }

  return (
    <div className="relative mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 lg:py-14">
      <Ambience intensity="soft" className="fixed" />

      <Button asChild variant="ghost" size="icon" className="press mb-4 rounded-xl">
        <Link to="/home" aria-label="Back to dashboard">
          <ArrowLeft className="size-4" />
        </Link>
      </Button>

      <Reveal>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Flashcards</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Build a deck from one of your series, or describe exactly what you want to revise.
        </p>
      </Reveal>

      <Reveal delay={0.08} className="mt-8">
        <div className="glass-card p-6 sm:p-8">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Build from a series</Label>
          <div className="mt-3 flex flex-wrap gap-2">
            {(series ?? []).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSeriesId((v) => (v === s.id ? null : s.id))}
                className={cn(
                  "press rounded-2xl border px-3.5 py-2 text-sm transition-colors",
                  seriesId === s.id
                    ? "border-primary/70 bg-primary/15 text-primary"
                    : "border-border/60 bg-card/60 text-muted-foreground hover:border-primary/40",
                )}
              >
                {s.title}
              </button>
            ))}
            {(series ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No series yet — create one or use a prompt below.</p>
            )}
          </div>

          <div className="mt-6 space-y-2">
            <Label htmlFor="deckPrompt" className="text-xs uppercase tracking-wide text-muted-foreground">
              Or write a prompt
            </Label>
            <Input
              id="deckPrompt"
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                if (e.target.value) setSeriesId(null);
              }}
              placeholder="Photosynthesis for a Year 10 biology test"
              className="h-11 rounded-xl bg-surface"
            />
          </div>

          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="press glow-ring mt-6 h-11 rounded-2xl font-semibold"
          >
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            {create.isPending ? "Writing your cards…" : "Generate deck"}
          </Button>
        </div>
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {(decks ?? []).map((d, i) => (
          <Reveal key={d.id} delay={0.04 * i}>
            <div className="glass-card flex h-full flex-col p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
                  <Layers className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-semibold">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.total} cards · {d.source === "series" ? "from a series" : d.source === "susu" ? "from Susu" : "from a prompt"}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Delete ${d.title}`}
                  onClick={() => void removeDeck(d.id)}
                  className="press rounded-lg p-1.5 text-muted-foreground transition hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <Progress value={d.total ? (d.known / d.total) * 100 : 0} className="mt-4 h-1.5" />
              <p className="mt-2 text-xs text-muted-foreground">
                {d.known} of {d.total} marked known
              </p>
              <Button
                onClick={() => setStudyDeck(d.id)}
                variant="secondary"
                className="press mt-4 h-10 w-full rounded-2xl font-semibold"
              >
                Study <ArrowRight className="size-4" />
              </Button>
            </div>
          </Reveal>
        ))}
        {(decks ?? []).length === 0 && (
          <div className="rounded-3xl border border-border/60 bg-card/60 p-8 text-center text-sm text-muted-foreground backdrop-blur-xl sm:col-span-2">
            <Sparkles className="mx-auto mb-3 size-5 text-primary" />
            No decks yet. Generate one above, or ask Susu in chat to make you a flashcard deck.
          </div>
        )}
      </div>
    </div>
  );
}

function StudyView({ deckId, onExit }: { deckId: string; onExit: () => void }) {
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const { data } = useQuery({
    queryKey: ["flashcard-deck", deckId],
    queryFn: async () => {
      const [{ data: deck }, { data: cards }] = await Promise.all([
        supabase.from("flashcard_decks").select("id, title").eq("id", deckId).maybeSingle(),
        supabase
          .from("flashcards")
          .select("id, front, back, known, reviews, order_index")
          .eq("deck_id", deckId)
          .order("order_index", { ascending: true }),
      ]);
      return { deck, cards: (cards ?? []) as Card[] };
    },
  });

  const cards = data?.cards ?? [];
  const card = cards[index];
  const knownCount = useMemo(() => cards.filter((c) => c.known).length, [cards]);

  async function mark(known: boolean) {
    if (!card) return;
    pop(known ? "correct" : "wrong");
    await supabase
      .from("flashcards")
      .update({ known, reviews: card.reviews + 1 })
      .eq("id", card.id);
    await queryClient.invalidateQueries({ queryKey: ["flashcard-deck", deckId] });
    setFlipped(false);
    setIndex((i) => Math.min(i + 1, cards.length - 1));
  }

  return (
    <div className="relative mx-auto w-full max-w-2xl px-5 py-10 sm:px-8 lg:py-14">
      <Ambience intensity="soft" className="fixed" />

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="press rounded-xl" onClick={onExit} aria-label="Back to decks">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-bold">{data?.deck?.title ?? "Deck"}</h1>
          <p className="text-xs text-muted-foreground">
            {cards.length ? `Card ${Math.min(index + 1, cards.length)} of ${cards.length}` : "Loading…"} · {knownCount}{" "}
            known
          </p>
        </div>
      </div>

      <Progress value={cards.length ? ((index + 1) / cards.length) * 100 : 0} className="mt-5 h-1.5" />

      <div className="mt-8" style={{ perspective: "1400px" }}>
        <AnimatePresence mode="wait">
          {card && (
            <motion.button
              key={card.id}
              type="button"
              onClick={() => setFlipped((f) => !f)}
              initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -18, filter: "blur(8px)" }}
              className="block w-full text-left"
              aria-label="Flip card"
            >
              <motion.div
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="relative h-64 w-full sm:h-72"
                style={{ transformStyle: "preserve-3d" }}
              >
                <div
                  className="glass-card absolute inset-0 grid place-items-center p-8 text-center"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Question</p>
                    <p className="mt-3 font-display text-xl font-semibold sm:text-2xl">{card.front}</p>
                    <p className="mt-5 text-xs text-muted-foreground">Tap to reveal</p>
                  </div>
                </div>
                <div
                  className="glass-card absolute inset-0 grid place-items-center border-primary/40 bg-primary/10 p-8 text-center"
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                >
                  <div>
                    <p className="text-xs uppercase tracking-wide text-primary">Answer</p>
                    <p className="mt-3 text-base leading-relaxed sm:text-lg">{card.back}</p>
                  </div>
                </div>
              </motion.div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {cards.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">This deck has no cards yet.</p>
      )}

      {card && (
        <div className="mt-7 flex items-center justify-between gap-3">
          <Button
            variant="secondary"
            className="press h-11 flex-1 rounded-2xl font-semibold"
            onClick={() => void mark(false)}
          >
            <X className="size-4" /> Still learning
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="press size-11 shrink-0 rounded-2xl"
            aria-label="Restart deck"
            onClick={() => {
              setIndex(0);
              setFlipped(false);
            }}
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button className="press h-11 flex-1 rounded-2xl font-semibold" onClick={() => void mark(true)}>
            <Check className="size-4" /> I know this
          </Button>
        </div>
      )}
    </div>
  );
}
