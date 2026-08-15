import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Layers, Loader2, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Ambience } from "@/components/motion/Ambience";
import { Markdown } from "@/components/chat/Markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { saveDeck } from "@/lib/flashcards.functions";
import { askSusu } from "@/lib/susu.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Talk to Susu — your AI study coach | Studly" },
      {
        name: "description",
        content: "Ask Susu for hints, explanations and worked examples. Susu coaches you through problems instead of handing over answers.",
      },
      { property: "og:title", content: "Talk to Susu" },
      { property: "og:description", content: "Hints, Socratic questions and worked examples from your AI study coach." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search["q"] === "string" ? search["q"] : undefined,
    ctx: typeof search["ctx"] === "string" ? search["ctx"] : undefined,
  }),
  component: ChatPage,
});

type Msg = { id: string; role: string; content: string; follow_ups: unknown; metadata: unknown };
type DeckOffer = { title: string; cards: { front: string; back: string }[] };

function ChatPage() {
  const { q, ctx } = Route.useSearch();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const ask = useServerFn(askSusu);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState(q ?? "");
  const [pending, setPending] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const autoSent = useRef(false);

  const { data: threads } = useQuery({
    queryKey: ["chat-threads", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_threads")
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["chat-messages", threadId],
    enabled: Boolean(threadId),
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, role, content, follow_ups, metadata")
        .eq("thread_id", threadId!)
        .order("created_at", { ascending: true });
      return (data ?? []) as Msg[];
    },
  });

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  const send = useMutation({
    mutationFn: async (text: string) => {
      if (!user) throw new Error("Sign in first.");
      let id = threadId;
      if (!id) {
        const { data, error } = await supabase
          .from("chat_threads")
          .insert({ user_id: user.id, title: text.slice(0, 48) })
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
        setThreadId(id);
      }

      const history = (messages ?? [])
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      await supabase.from("chat_messages").insert({ thread_id: id, user_id: user.id, role: "user", content: text });
      setPending(text);

      const res = await ask({ data: { question: text, ...(ctx ? { context: ctx } : {}), history } });

      await supabase.from("chat_messages").insert({
        thread_id: id,
        user_id: user.id,
        role: "assistant",
        content: res.reply,
        follow_ups: res.followUps,
        metadata: res.deck ? { deck: res.deck } : {},
      });
      await supabase.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", id);
      return id;
    },
    onSuccess: async (id) => {
      setPending(null);
      setDraft("");
      await queryClient.invalidateQueries({ queryKey: ["chat-messages", id] });
      await queryClient.invalidateQueries({ queryKey: ["chat-threads", user?.id] });
    },
    onError: (error) => {
      setPending(null);
      toast.error(error instanceof Error ? error.message : "Susu could not answer.");
    },
  });

  useEffect(() => {
    if (q && !autoSent.current && user) {
      autoSent.current = true;
      send.mutate(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, user]);

  async function removeThread(id: string) {
    await supabase.from("chat_threads").delete().eq("id", id);
    if (id === threadId) setThreadId(null);
    await queryClient.invalidateQueries({ queryKey: ["chat-threads", user?.id] });
  }

  const list = messages ?? [];
  const last = list[list.length - 1];
  const followUps = Array.isArray(last?.follow_ups) ? (last.follow_ups as string[]) : [];

  return (
    <div className="relative flex min-h-screen">
      <Ambience intensity="soft" className="fixed" />

      <aside className="hidden w-64 shrink-0 border-r border-border/50 p-4 lg:block">
        <Button
          className="press mb-4 h-10 w-full rounded-2xl"
          onClick={() => {
            setThreadId(null);
            setDraft("");
          }}
        >
          <Plus className="mr-1.5 size-4" /> New chat
        </Button>
        <div className="space-y-1">
          {(threads ?? []).map((t) => (
            <div key={t.id} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => setThreadId(t.id)}
                className={cn(
                  "min-w-0 flex-1 truncate rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  t.id === threadId ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                {t.title}
              </button>
              <button
                type="button"
                aria-label={`Delete ${t.title}`}
                onClick={() => void removeThread(t.id)}
                className="press rounded-lg p-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 py-6 sm:px-8">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="press rounded-xl">
            <Link to="/home" aria-label="Back to dashboard">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="font-display text-lg font-bold">Susu</h1>
            <p className="text-xs text-muted-foreground">Hints and coaching, never finished homework</p>
          </div>
        </div>

        <div className="mt-6 flex-1 space-y-4">
          {list.length === 0 && !pending && (
            <div className="rounded-3xl border border-border/60 bg-card/70 p-7 text-center backdrop-blur-xl">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">
                <Sparkles className="size-6" />
              </span>
              <p className="mt-4 font-display text-lg font-semibold">Stuck on something?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tell Susu the question and what you have tried. You will get hints, not a copy-paste answer.
              </p>
            </div>
          )}

          {list.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              className={cn(
                "max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-relaxed",
                m.role === "user"
                  ? "ml-auto bg-primary/15 text-foreground"
                  : "border border-border/60 bg-card/70 backdrop-blur-xl",
              )}
            >
              {m.role === "assistant" ? <Markdown content={m.content} /> : m.content}
              {m.role === "assistant" && <DeckCard metadata={m.metadata} />}
            </motion.div>
          ))}

          <AnimatePresence>
            {pending && (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="ml-auto max-w-[85%] rounded-3xl bg-primary/15 px-4 py-3 text-sm"
                >
                  {pending}
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 rounded-3xl border border-border/60 bg-card/70 px-4 py-3 text-sm text-muted-foreground backdrop-blur-xl"
                >
                  <Loader2 className="size-4 animate-spin" /> Susu is thinking…
                </motion.div>
              </>
            )}
          </AnimatePresence>
          <div ref={bottom} />
        </div>

        {followUps.length > 0 && !pending && (
          <div className="mt-4 flex flex-wrap gap-2">
            {followUps.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => send.mutate(f)}
                className="press rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-xl transition-colors hover:border-primary/50 hover:text-primary"
              >
                {f}
              </button>
            ))}
          </div>
        )}

        <form
          className="sticky bottom-4 mt-5 flex items-end gap-2 rounded-3xl border border-border/60 bg-card/80 p-2 backdrop-blur-xl"
          onSubmit={(e) => {
            e.preventDefault();
            const text = draft.trim();
            if (text && !send.isPending) send.mutate(text);
          }}
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask Susu for a hint…"
            rows={1}
            className="max-h-32 min-h-11 resize-none border-0 bg-transparent focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const text = draft.trim();
                if (text && !send.isPending) send.mutate(text);
              }
            }}
          />
          <Button type="submit" size="icon" className="press size-11 shrink-0 rounded-2xl" disabled={send.isPending}>
            {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}

function DeckCard({ metadata }: { metadata: unknown }) {
  const store = useServerFn(saveDeck);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const deck = (metadata as { deck?: DeckOffer } | null)?.deck;
  if (!deck?.cards?.length) return null;

  async function add() {
    setSaving(true);
    try {
      await store({ data: { title: deck!.title, source: "susu", cards: deck!.cards } });
      setSaved(true);
      toast.success("Deck added to your Flashcards tab.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The deck could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/[0.07] p-4">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <Layers className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold">{deck.title}</p>
          <p className="text-xs text-muted-foreground">{deck.cards.length} flashcards ready</p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {deck.cards.slice(0, 3).map((c) => (
          <p key={c.front} className="truncate text-xs text-muted-foreground">
            · {c.front}
          </p>
        ))}
      </div>
      {saved ? (
        <Button asChild variant="secondary" className="press mt-4 h-9 w-full rounded-xl text-xs font-semibold">
          <Link to="/flashcards">Open Flashcards</Link>
        </Button>
      ) : (
        <Button onClick={() => void add()} disabled={saving} className="press mt-4 h-9 w-full rounded-xl text-xs font-semibold">
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Layers className="size-3.5" />}
          Add to my flashcards
        </Button>
      )}
    </div>
  );
}
