import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardPaste,
  Clapperboard,
  Film,
  ImagePlus,
  Loader2,
  Paperclip,
  Sparkles,
  Trash2,
  UserPlus,
  Youtube,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Ambience } from "@/components/motion/Ambience";
import { Reveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { uploadCastPhotos, uploadMaterial } from "@/lib/cast";
import { generateSeriesCover } from "@/lib/covers.functions";
import { buildEpisode, startGeneration } from "@/lib/generate.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/create")({
  head: () => ({
    meta: [
      { title: "Create a series — turn any topic into episodes | Studly" },
      {
        name: "description",
        content: "Enter a topic, add your notes, files or a YouTube link, cast your actors and Studly writes an episode series with pop quizzes.",
      },
      { property: "og:title", content: "Create a Studly series" },
      { property: "og:description", content: "Topic in, cinematic episodes and quizzes out." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreatePage,
});

type CastRow = { key: string; name: string; role: string; files: File[]; savedId?: string };
type SavedChar = { id: string; name: string; role: string; image: string | null };


const STAGES = [
  "Writing the shooting script",
  "Casting your actors",
  "Building the storyboard",
  "Lighting the set",
  "Filming the scenes",
  "Scoring the soundtrack",
  "Cutting the final edit",
];

const FACTS = [
  "Spaced repetition beats cramming by a wide margin — even five minutes a day compounds.",
  "The first film with synchronised dialogue was The Jazz Singer, in 1927.",
  "Testing yourself is a better study tool than re-reading. That is why the pop quizzes exist.",
  "Pixar renders a single frame for hours; your episode takes a little less.",
  "Explaining a topic out loud reveals gaps faster than highlighting ever will.",
  "A standard film runs 24 frames a second — 86,400 frames an hour.",
];

const STEPS = ["Topic", "Materials", "Cast", "Generate"];

function CreatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const start = useServerFn(startGeneration);
  const build = useServerFn(buildEpisode);
  const makeCover = useServerFn(generateSeriesCover);

  const [step, setStep] = useState(0);
  const [topic, setTopic] = useState("");
  const [episodeCount, setEpisodeCount] = useState(5);
  const [notes, setNotes] = useState("");
  const [youtube, setYoutube] = useState("");
  const [materials, setMaterials] = useState<File[]>([]);
  const [cast, setCast] = useState<CastRow[]>([{ key: crypto.randomUUID(), name: "", role: "", files: [] }]);
  const [savedChars, setSavedChars] = useState<SavedChar[]>([]);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [loadingCast, setLoadingCast] = useState(true);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(STAGES[0]!);
  const [fact, setFact] = useState(FACTS[0]!);
  const [titles, setTitles] = useState<string[]>([]);
  const [doneCount, setDoneCount] = useState(0);
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void (async () => {
      const { data } = await supabase
        .from("characters")
        .select("id, name, role_description, image_urls")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });
      if (!alive) return;
      setSavedChars(
        (data ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          role: c.role_description ?? "",
          image: (c.image_urls as string[] | null)?.[0] ?? null,
        })),
      );
      setLoadingCast(false);
    })();
    return () => {
      alive = false;
    };
  }, [user]);


  useEffect(() => {
    if (!running) return;
    const s = window.setInterval(() => setStage(STAGES[Math.floor(Math.random() * STAGES.length)]!), 3400);
    const f = window.setInterval(() => setFact(FACTS[Math.floor(Math.random() * FACTS.length)]!), 6000);
    return () => {
      window.clearInterval(s);
      window.clearInterval(f);
    };
  }, [running]);

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        toast.error("Your clipboard is empty.");
        return;
      }
      const el = notesRef.current;
      const at = el?.selectionStart ?? notes.length;
      setNotes(notes.slice(0, at) + text + notes.slice(at));
      toast.success("Pasted from clipboard");
    } catch {
      toast.error("Clipboard access was blocked — paste with ⌘V instead.");
    }
  }

  async function generate() {
    if (!user) return;
    setRunning(true);
    setProgress(6);
    try {
      const named = cast.filter((c) => c.name.trim());
      const savedCast: { id?: string; name: string; role?: string }[] = pickedIds
        .map((id) => savedChars.find((c) => c.id === id))
        .filter((c): c is SavedChar => Boolean(c))
        .map((c) => ({ id: c.id, name: c.name, role: c.role }));

      for (const row of named) {
        const uploaded = await uploadCastPhotos(user.id, row.files);
        const { data } = await supabase
          .from("characters")
          .insert({
            owner_id: user.id,
            name: row.name.trim(),
            role_description: row.role.trim() || null,
            image_paths: uploaded.paths,
            image_urls: uploaded.urls,
          })
          .select("id")
          .single();
        savedCast.push({ ...(data?.id ? { id: data.id } : {}), name: row.name.trim(), role: row.role.trim() });
      }

      const fileNotes: string[] = [];
      for (const file of materials) {
        const up = await uploadMaterial(user.id, file);
        fileNotes.push(up.name);
        await supabase.from("study_materials").insert({
          owner_id: user.id,
          kind: "file",
          file_name: up.name,
          file_path: up.path,
          mime_type: up.type || null,
          size_bytes: up.size,
        });
      }

      setProgress(12);
      const combinedNotes = [notes.trim(), fileNotes.length ? `Uploaded files: ${fileNotes.join(", ")}` : ""]
        .filter(Boolean)
        .join("\n\n");

      const plan = await start({
        data: {
          topic: topic.trim(),
          episodeCount,
          cast: savedCast,
          ...(combinedNotes ? { notes: combinedNotes } : {}),
          ...(youtube.trim() ? { youtubeUrl: youtube.trim() } : {}),
        },
      });

      setTitles(plan.episodeTitles);
      setSeriesId(plan.seriesId);
      setProgress(18);

      setStage("Painting the cover art");
      void makeCover({ data: { seriesId: plan.seriesId, title: plan.title, topic: topic.trim() } }).catch(() => {});

      for (let i = 0; i < plan.episodeTitles.length; i += 1) {
        const res = await build({ data: { jobId: plan.jobId, index: i, topic: topic.trim(), cast: savedCast } });
        setDoneCount(res.done);
        setProgress(Math.round(18 + (res.done / res.total) * 82));
      }

      setStage("Final cut delivered");
      setProgress(100);
      toast.success("Your series is ready");
    } catch (error) {
      setRunning(false);
      toast.error(error instanceof Error ? error.message : "Generation failed. Try again.");
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-2xl px-5 py-10 sm:px-8 lg:py-14">
      <Ambience intensity="soft" className="fixed" />

      {!running && (
        <>
          <Button asChild variant="ghost" size="icon" className="press rounded-xl">
            <Link to="/home" aria-label="Back to dashboard">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>

          <div className="cta-sheen mt-4 overflow-hidden rounded-3xl border border-primary/25 bg-card/70 backdrop-blur-xl">
            <div className="relative bg-[linear-gradient(135deg,oklch(0.55_0.15_302/0.55),oklch(0.66_0.13_322/0.35)_48%,transparent)] p-6 sm:p-8">
              <div className="relative z-[2] flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/12 text-foreground ring-1 ring-white/20">
                  <Clapperboard className="size-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                    Studly Studios
                  </p>
                  <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                    Create a series
                  </h1>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Four quick steps — your topic, your material, your cast. Studly films the rest.
                  </p>
                </div>
              </div>
            </div>
          </div>


          <div className="mt-7 flex items-center gap-2">
            {STEPS.map((label, i) => (
              <div key={label} className="flex flex-1 items-center gap-2">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors",
                    i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {i < step ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className={cn("hidden text-xs font-medium sm:block", i === step ? "text-foreground" : "text-muted-foreground")}>
                  {label}
                </span>
                {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border/60" />}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.section
              key={step}
              initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="mt-7 rounded-3xl border border-border/60 bg-card/70 p-6 backdrop-blur-xl sm:p-8"
            >
              {step === 0 && (
                <>
                  <h2 className="font-display text-lg font-semibold">What are you studying?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Be specific — “photosynthesis for IGCSE biology” beats “science”.</p>
                  <Input
                    autoFocus
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Topic of study"
                    className="mt-5 h-12 rounded-2xl"
                  />
                  <div className="mt-5">
                    <p className="text-sm font-medium">How many episodes?</p>
                    <div className="mt-2 flex gap-2">
                      {[3, 4, 5, 6, 8].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setEpisodeCount(n)}
                          className={cn(
                            "press h-10 w-12 rounded-xl border text-sm font-semibold transition-colors",
                            n === episodeCount ? "border-primary bg-primary/15 text-primary" : "border-border/60 text-muted-foreground",
                          )}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <h2 className="font-display text-lg font-semibold">Add your study material</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Optional, but the more you give Susu the sharper the episodes.</p>

                  <Textarea
                    ref={notesRef}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text");
                      if (!text) return;
                      e.preventDefault();
                      const el = e.currentTarget;
                      const startAt = el.selectionStart;
                      const endAt = el.selectionEnd;
                      setNotes(notes.slice(0, startAt) + text + notes.slice(endAt));
                    }}
                    placeholder="Paste notes, a syllabus, or a chapter here…"
                    className="mt-5 min-h-32 rounded-2xl"
                  />
                  <Button variant="ghost" size="sm" className="press mt-2 rounded-xl text-xs" onClick={() => void pasteFromClipboard()}>
                    <ClipboardPaste className="mr-1.5 size-3.5" /> Paste from clipboard
                  </Button>

                  <div className="mt-5">
                    <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                      <Youtube className="size-4 text-primary" /> YouTube link
                    </p>
                    <Input
                      value={youtube}
                      onChange={(e) => setYoutube(e.target.value)}
                      placeholder="https://youtube.com/watch?v=…"
                      className="h-11 rounded-2xl"
                    />
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <label className="press inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-border/60 bg-background/50 px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary/50">
                      <Paperclip className="size-4" /> Upload files
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.ppt,.pptx,.mp4,image/*"
                        className="hidden"
                        onChange={(e) => {
                          const picked = Array.from(e.target.files ?? []);
                          const tooBig = picked.filter((f) => f.size > 25 * 1024 * 1024);
                          if (tooBig.length) toast.error(`${tooBig[0]!.name} is over 25 MB.`);
                          setMaterials((prev) => [...prev, ...picked.filter((f) => f.size <= 25 * 1024 * 1024)]);
                        }}
                      />
                    </label>
                    {materials.map((f) => (
                      <span key={f.name} className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary">
                        {f.name}
                        <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setMaterials((prev) => prev.filter((x) => x !== f))}>
                          <Trash2 className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">PDF, PPT, PPTX, MP4 or images · up to 25 MB each</p>
                </>
              )}

              {step === 2 && (
                <>
                  <h2 className="font-display text-lg font-semibold">Cast your actors</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Name each character and add reference photos so they look consistent across the series.
                  </p>

                  {!loadingCast && savedChars.length > 0 && (
                    <div className="mt-5 rounded-2xl border border-border/60 bg-background/40 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">Your saved cast</p>
                        <Button asChild variant="ghost" size="sm" className="press rounded-xl text-xs">
                          <Link to="/cast">Manage</Link>
                        </Button>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Tap to load characters you already made into this series.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {savedChars.map((c) => {
                          const on = pickedIds.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() =>
                                setPickedIds((prev) => (on ? prev.filter((x) => x !== c.id) : [...prev, c.id]))
                              }
                              className={cn(
                                "press flex items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition-colors",
                                on
                                  ? "border-primary/60 bg-primary/15"
                                  : "border-border/60 bg-background/50 hover:border-primary/40",
                              )}
                            >
                              {c.image ? (
                                <img
                                  src={c.image}
                                  alt={c.name}
                                  className="size-8 rounded-xl object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <span className="grid size-8 place-items-center rounded-xl bg-primary/20 text-[11px] font-bold text-primary">
                                  {c.name.slice(0, 1).toUpperCase()}
                                </span>
                              )}
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-semibold">{c.name}</span>
                                {c.role && (
                                  <span className="block max-w-[9rem] truncate text-[11px] text-muted-foreground">
                                    {c.role}
                                  </span>
                                )}
                              </span>
                              {on && <Check className="size-3.5 text-primary" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Add new characters
                  </p>


                  <div className="mt-5 space-y-3">
                    {cast.map((row) => (
                      <div key={row.key} className="rounded-2xl border border-border/60 bg-background/40 p-4">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            value={row.name}
                            onChange={(e) =>
                              setCast((prev) => prev.map((c) => (c.key === row.key ? { ...c, name: e.target.value } : c)))
                            }
                            placeholder="Name"
                            className="h-11 rounded-xl"
                          />
                          <Input
                            value={row.role}
                            onChange={(e) =>
                              setCast((prev) => prev.map((c) => (c.key === row.key ? { ...c, role: e.target.value } : c)))
                            }
                            placeholder="Role in the story"
                            className="h-11 rounded-xl"
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <label className="press inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-xs font-medium transition-colors hover:border-primary/50">
                            <ImagePlus className="size-3.5" /> Reference photos
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                const picked = Array.from(e.target.files ?? []);
                                setCast((prev) =>
                                  prev.map((c) => (c.key === row.key ? { ...c, files: [...c.files, ...picked] } : c)),
                                );
                              }}
                            />
                          </label>
                          {row.files.map((f) => (
                            <span key={f.name} className="rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-medium text-primary">
                              {f.name}
                            </span>
                          ))}
                          {cast.length > 1 && (
                            <button
                              type="button"
                              aria-label="Remove cast member"
                              className="press ml-auto rounded-lg p-1.5 text-muted-foreground hover:text-destructive"
                              onClick={() => setCast((prev) => prev.filter((c) => c.key !== row.key))}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    variant="ghost"
                    className="press mt-3 rounded-2xl text-sm"
                    onClick={() => setCast((prev) => [...prev, { key: crypto.randomUUID(), name: "", role: "", files: [] }])}
                  >
                    <UserPlus className="mr-1.5 size-4" /> Add another
                  </Button>
                </>
              )}

              {step === 3 && (
                <>
                  <h2 className="font-display text-lg font-semibold">Ready to roll</h2>
                  <dl className="mt-5 space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Topic</dt>
                      <dd className="text-right font-medium">{topic || "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Episodes</dt>
                      <dd className="font-medium">{episodeCount}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Material</dt>
                      <dd className="text-right font-medium">
                        {[notes.trim() && "notes", youtube.trim() && "YouTube link", materials.length && `${materials.length} file(s)`]
                          .filter(Boolean)
                          .join(", ") || "topic only"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Cast</dt>
                      <dd className="text-right font-medium">
                        {[
                          ...pickedIds.map((id) => savedChars.find((c) => c.id === id)?.name).filter(Boolean),
                          ...cast.filter((c) => c.name.trim()).map((c) => c.name.trim()),
                        ].join(", ") || "narrator only"}

                      </dd>
                    </div>
                  </dl>
                  <Button className="press glow-ring mt-6 h-12 w-full rounded-2xl" onClick={() => void generate()}>
                    <Clapperboard className="mr-2 size-4" /> Generate my series
                  </Button>
                </>
              )}
            </motion.section>
          </AnimatePresence>

          {step < 3 && (
            <div className="mt-6 flex items-center justify-between">
              <Button variant="ghost" className="press rounded-2xl" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
              <Button
                className="press h-11 rounded-2xl px-6"
                disabled={step === 0 && !topic.trim()}
                onClick={() => setStep((s) => s + 1)}
              >
                Continue <ArrowRight className="ml-1.5 size-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {running && (
        <Reveal className="pt-6">
          <div className="text-center">
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
              className="mx-auto grid size-20 place-items-center rounded-full border border-primary/40 bg-primary/10 text-primary shadow-glow-sm"
            >
              <Film className="size-9" />
            </motion.span>
            <h1 className="mt-6 font-display text-2xl font-bold tracking-tight">Rolling camera</h1>
            <AnimatePresence mode="wait">
              <motion.p
                key={stage}
                initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
                className="mt-2 text-sm text-primary"
              >
                {stage}
              </motion.p>
            </AnimatePresence>
            <Progress value={progress} className="mx-auto mt-5 h-2 max-w-sm" />
            <p className="mt-2 text-xs text-muted-foreground">{progress}%</p>
          </div>

          <div className="mt-8 space-y-2">
            {(titles.length ? titles : Array.from({ length: episodeCount }, (_, i) => `Episode ${i + 1}`)).map((t, i) => {
              const done = i < doneCount;
              const active = i === doneCount && progress < 100;
              return (
                <motion.div
                  key={`${t}-${i}`}
                  layout
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors",
                    done ? "border-primary/50 bg-primary/10" : active ? "border-primary/30 bg-card/70" : "border-border/50 bg-card/40",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                      done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="size-3.5" /> : active ? <Loader2 className="size-3.5 animate-spin" /> : i + 1}
                  </span>
                  <span className={cn("min-w-0 flex-1 truncate", !done && !active && "text-muted-foreground")}>{t}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{done ? "Ready" : active ? "Filming" : "Queued"}</span>
                </motion.div>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={fact}
              initial={{ opacity: 0, filter: "blur(8px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(8px)" }}
              className="mt-8 rounded-2xl border border-border/60 bg-card/60 p-4 text-center text-sm text-muted-foreground backdrop-blur-xl"
            >
              <Sparkles className="mr-1.5 inline size-3.5 text-primary" />
              {fact}
            </motion.p>
          </AnimatePresence>

          {progress === 100 && seriesId && (
            <Button
              className="press glow-ring mt-6 h-12 w-full rounded-2xl"
              onClick={() => navigate({ to: "/series/$seriesId", params: { seriesId } })}
            >
              Watch your series <ArrowRight className="ml-1.5 size-4" />
            </Button>
          )}
        </Reveal>
      )}
    </div>
  );
}
