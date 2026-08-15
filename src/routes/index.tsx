import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import {
  Clapperboard,
  FileText,
  Flame,
  GraduationCap,
  Link2,
  Pause,
  Play,
  Sparkles,
  Type,
  Users,
} from "lucide-react";

import { Ambience } from "@/components/motion/Ambience";
import { Floaty, RevealItem, ScrollReveal, ScrollRevealGroup } from "@/components/motion/Reveal";
import { StudlyLogo } from "@/components/brand/StudlyLogo";
import { Markdown } from "@/components/chat/Markdown";
import { Button } from "@/components/ui/button";
import drMoAvatar from "@/assets/hero/dr-mo.jpg";
import irisAvatar from "@/assets/hero/iris.jpg";
import lexAvatar from "@/assets/hero/lex.jpg";
import { LEAGUE_TIERS, TROPHIES } from "@/lib/trophies";

const ROTATING_SUBTITLES = [
  "Your notes, but actually watchable.",
  "Your friends, but they're teaching you.",
  "Your group chat, but somehow educational.",
  "Your revision, but make it a whole episode.",
  "Studying, but you actually wanna press play.",
];

function RotatingSubtitle() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % ROTATING_SUBTITLES.length);
    }, 3600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative mx-auto mt-4 h-[1.4em] max-w-xl">
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={{ opacity: 0, filter: "blur(14px)", y: 8 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          exit={{ opacity: 0, filter: "blur(14px)", y: -8 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-x-0 font-sans text-lg font-light tracking-tight text-muted-foreground sm:text-xl"
        >
          {ROTATING_SUBTITLES[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Hero — live auto-playing mini preview                            */
/* ------------------------------------------------------------------ */

const PREVIEW_SLIDE = {
  kicker: "Episode 3",
  title: "Why cells need mitochondria",
  bullets: [
    "ATP is the cell's spendable energy currency",
    "The inner membrane's folds multiply surface area",
    "More energy demand means more mitochondria",
  ],
  takeaway: "Structure follows the energy bill.",
};

function HeroPreview() {
  const [revealed, setRevealed] = useState(0);
  const [progress, setProgress] = useState(0); // 0..1
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const total = 9; // seconds for the loop
    const start = Date.now();
    const id = setInterval(() => {
      const t = ((Date.now() - start) / 1000) % total;
      setProgress(t / total);
      // reveal bullets progressively
      setRevealed(Math.min(PREVIEW_SLIDE.bullets.length, Math.floor((t / total) * (PREVIEW_SLIDE.bullets.length + 2))));
      if (t > total - 0.05) setRevealed(0);
    }, 120);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <Floaty className="mt-28 sm:mt-40" amount={10}>
      <div
        className="glass-card glow-ring mx-auto max-w-2xl overflow-hidden p-0"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* 16:9 stage */}
        <div className="relative aspect-[16/9] w-full overflow-hidden">
          {/* ken burns bg */}
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, oklch(0.63 0.115 300 / 0.32), transparent 60%), radial-gradient(circle at 75% 70%, oklch(0.55 0.13 320 / 0.28), transparent 65%), var(--color-surface-2)",
            }}
            animate={{ scale: [1, 1.08, 1], x: [0, -8, 0], y: [0, 6, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* content */}
          <div className="relative flex h-full flex-col justify-center gap-3 p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              {PREVIEW_SLIDE.kicker}
            </p>
            <h2 className="font-display text-xl font-semibold sm:text-2xl">
              {PREVIEW_SLIDE.title}
            </h2>
            <ul className="mt-1 space-y-1.5 text-xs text-muted-foreground sm:text-sm">
              {PREVIEW_SLIDE.bullets.map((b, i) => (
                <motion.li
                  key={b}
                  initial={{ opacity: 0, filter: "blur(10px)", x: -8 }}
                  animate={
                    i < revealed
                      ? { opacity: 1, filter: "blur(0px)", x: 0 }
                      : { opacity: 0, filter: "blur(10px)", x: -8 }
                  }
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  • {b}
                </motion.li>
              ))}
            </ul>
            <AnimatePresence>
              {revealed >= PREVIEW_SLIDE.bullets.length && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-2 inline-block w-fit rounded-xl bg-primary/15 p-3 text-xs ring-1 ring-primary/30 sm:text-sm"
                >
                  <span className="font-semibold text-foreground">Takeaway: </span>
                  <span className="text-muted-foreground">{PREVIEW_SLIDE.takeaway}</span>
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          {/* play glyph */}
          <div className="absolute right-4 top-4 flex items-center gap-2 text-muted-foreground">
            {paused ? <Pause className="size-4" /> : <Play className="size-4" />}
          </div>
        </div>
        {/* faux scrub bar */}
        <div className="relative h-9 w-full bg-surface px-4">
          <div className="absolute inset-x-4 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-muted/60">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>
    </Floaty>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Netflix-style cover shelves                                       */
/* ------------------------------------------------------------------ */

const SHELF = [
  { title: "Biology", subtitle: "Cells, energy & life", episodes: 8, hue: 150 },
  { title: "Mathematics", subtitle: "Algebra to calculus", episodes: 10, hue: 280 },
  { title: "History", subtitle: "Empires & revolutions", episodes: 7, hue: 30 },
  { title: "Chemistry", subtitle: "Reactions & matter", episodes: 6, hue: 200 },
  { title: "Physics", subtitle: "Forces & motion", episodes: 9, hue: 260 },
  { title: "Psychology", subtitle: "Mind & behaviour", episodes: 8, hue: 320 },
];

function CoverShelf() {
  return (
    <section className="relative mx-auto w-full max-w-6xl px-5 pb-8 sm:px-8">
      <ScrollReveal>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-semibold sm:text-2xl">Studly Originals</h2>
          <span className="text-sm text-muted-foreground">Trending this season</span>
        </div>
      </ScrollReveal>
      <ScrollReveal delay={0.1} className="mt-4">
        <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-4 sm:-mx-8 sm:px-8 [scrollbar-width:thin]">
          {SHELF.map((s) => (
            <div
              key={s.title}
              className="group lift relative aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-2xl ring-1 ring-border sm:w-48"
            >
              {/* gradient cover */}
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(155deg, oklch(0.5 0.14 ${s.hue}) 0%, oklch(0.3 0.1 ${s.hue}) 55%, oklch(0.18 0.03 ${s.hue}) 100%)`,
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              <div className="relative flex h-full flex-col justify-end p-4">
                <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-white/70">
                  S1 · {s.episodes} eps
                </p>
                <h3 className="mt-1 font-display text-lg font-bold text-white">{s.title}</h3>
                <p className="text-xs text-white/70">{s.subtitle}</p>
              </div>
              {/* hover play */}
              <div className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <span className="grid size-12 place-items-center rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/30">
                  <Play className="size-5 fill-white text-white" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollReveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3. How it works — 3-step zigzag                                      */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    n: 1,
    title: "Drop a topic",
    body: "Type a topic, paste your notes, or drop a PDF, slides, or a YouTube link. Studly reads it all.",
    icons: [Type, FileText, Link2],
    mock: (
      <div className="glass-card flex items-center gap-3 p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
          <Type className="size-4" />
        </div>
        <div className="flex-1 rounded-full bg-surface px-4 py-2 text-sm text-muted-foreground">
          Photosynthesis, for a 6th-grader…
        </div>
      </div>
    ),
  },
  {
    n: 2,
    title: "Cast your characters",
    body: "Name a tutor, add a reference photo, and Studly keeps them consistent across every episode.",
    icons: [Users],
    mock: (
      <div className="glass-card flex items-center gap-3 p-4">
        {[
          { name: "Dr. Mo", image: drMoAvatar },
          { name: "Lex", image: lexAvatar },
          { name: "Iris", image: irisAvatar },
        ].map((p) => (
          <div key={p.name} className="flex flex-col items-center gap-1">
            <div className="size-11 overflow-hidden rounded-full bg-primary/15 ring-1 ring-primary/30">
              <img src={p.image} alt={p.name} className="size-full object-cover" />
            </div>
            <span className="text-xs text-muted-foreground">{p.name}</span>
          </div>
        ))}
        <span className="ml-auto text-sm text-muted-foreground">+ add</span>
      </div>
    ),
  },
  {
    n: 3,
    title: "Press play",
    body: "Episodes auto-generate with a cinematic player, pop-up quizzes, and captions. Then quiz, flashcards, and Susu take over.",
    icons: [Clapperboard],
    mock: (
      <div className="relative mx-auto h-52 w-full max-w-sm sm:h-56">
        {[
          { label: "Episode 3", rot: -7, x: -26, y: 16, z: 10, hue: 200, scale: 0.9, blur: true },
          { label: "Episode 2", rot: 4, x: 18, y: 8, z: 20, hue: 320, scale: 0.95, blur: true },
          { label: "Episode 1", rot: -1, x: 0, y: -10, z: 30, hue: 300, scale: 1, blur: false },
        ].map((card) => (
          <div
            key={card.label}
            className="absolute inset-x-0 top-1/2 mx-auto aspect-[16/9] w-[88%] overflow-hidden rounded-2xl ring-1 ring-border shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)]"
            style={{
              zIndex: card.z,
              transform: `translateY(calc(-50% + ${card.y}px)) translateX(${card.x}px) rotate(${card.rot}deg) scale(${card.scale})`,
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at 30% 30%, oklch(0.63 0.115 ${card.hue} / 0.35), transparent 60%), var(--color-surface-2)`,
                filter: card.blur ? "blur(1.5px) brightness(0.75)" : undefined,
              }}
            />
            {!card.blur && (
              <div className="relative flex h-full items-center justify-center">
                <span className="grid size-12 place-items-center rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/30">
                  <Play className="size-5 fill-white text-white" />
                </span>
              </div>
            )}
            <p className="absolute bottom-3 left-3 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
              {card.label}
            </p>
          </div>
        ))}
      </div>
    ),

  },
];

function HowItWorks() {
  return (
    <section className="relative mx-auto w-full max-w-5xl px-5 py-20 sm:px-8">
      <ScrollReveal className="text-center">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">From notes to a season in 3 steps</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          No setup, no editing software. Just your study material and a press of a button.
        </p>
      </ScrollReveal>
      <div className="mt-12 space-y-16">
        {STEPS.map((step, i) => {
          const flip = i % 2 === 1;
          return (
            <ScrollReveal key={step.n}>
              <div className="grid items-center gap-6 sm:grid-cols-2 sm:gap-10">
                <div className={flip ? "sm:order-2" : ""}>
                  <div className="mb-3 flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-full bg-primary/15 font-display text-sm font-bold text-primary ring-1 ring-primary/30">
                      {step.n}
                    </span>
                    <h3 className="font-display text-lg font-semibold">{step.title}</h3>
                  </div>
                  <p className="max-w-sm text-sm text-muted-foreground sm:max-w-none">{step.body}</p>
                </div>
                <div className={flip ? "sm:order-1" : ""}>{step.mock}</div>
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Susu spotlight                                                    */
/* ------------------------------------------------------------------ */

const SUSU_SAMPLE = `**Student:** Why does mitosis matter?\n\n**Susu:** Good question to sit with. Instead of the answer straight up — what would *go wrong* in a multicellular body if cells couldn't divide? Think **growth** and **repair**, then tell me which one breaks first.`;

function SusuSpotlight() {
  return (
    <section className="relative mx-auto w-full max-w-5xl px-5 py-20 sm:px-8">
      <div className="grid items-center gap-8 sm:grid-cols-2 sm:gap-12">
        <ScrollReveal>
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary ring-1 ring-primary/30">
            <Sparkles className="size-3.5" /> Susu
          </span>
          <h2 className="mt-4 font-display text-2xl font-bold sm:text-3xl">A tutor that coaches, never cheats.</h2>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Susu sits inside the chat like a study buddy who's read every episode. Ask a question mid-quiz and
            get a Socratic nudge, a mini-quiz, or a flashcard deck — never the answer on a plate.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
            <li>• Hints that lead you to the "aha"</li>
            <li>• Generates flashcard decks on request</li>
            <li>• Follows up straight from a wrong quiz answer</li>
          </ul>
        </ScrollReveal>
        <Floaty amount={7}>
          <ScrollReveal delay={0.1}>
            <div className="glass-card glow-ring mx-auto max-w-md p-5">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <span className="grid size-7 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
                  <GraduationCap className="size-4" />
                </span>
                <span className="text-sm font-semibold">Susu</span>
                <span className="ml-auto flex items-center gap-1 text-xs text-success">
                  <span className="size-1.5 rounded-full bg-success" /> online
                </span>
              </div>
              <div className="pt-3 text-sm text-muted-foreground">
                <Markdown content={SUSU_SAMPLE} />
              </div>
            </div>
          </ScrollReveal>
        </Floaty>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Leagues & trophies showcase                                       */
/* ------------------------------------------------------------------ */

function LeaguesShowcase() {
  return (
    <section className="relative mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
      <ScrollReveal className="text-center">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Two-week seasons. Promotion is the goal.</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Climb six tiers, keep your streak lit, and finish the season in the top three.
        </p>
      </ScrollReveal>

      <ScrollRevealGroup className="mt-10 flex flex-wrap items-end justify-center gap-4 sm:gap-6">
        {LEAGUE_TIERS.map((tier, i) => {
          const t = TROPHIES[tier]!;
          return (
            <RevealItem key={tier}>
              <div className="flex flex-col items-center gap-2">
                <div
                  className="relative grid size-16 place-items-center rounded-2xl bg-surface-2 ring-1 ring-border sm:size-20"
                  style={{ boxShadow: `0 14px 40px -22px ${t.glow}` }}
                >
                  <img
                    src={t.url}
                    alt={t.name}
                    className="size-12 object-contain drop-shadow-[0_0_16px_var(--color-primary)] sm:size-14"
                    style={{ filter: `drop-shadow(0 0 10px ${t.glow})` }}
                  />
                  {i === 0 && (
                    <span className="absolute -top-2 -right-2 rounded-full bg-primary px-2 py-0.5 text-[0.6rem] font-bold text-primary-foreground">
                      You
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-muted-foreground">{t.name}</span>
              </div>
            </RevealItem>
          );
        })}
      </ScrollRevealGroup>

      <ScrollReveal delay={0.15} className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <div className="glass-card flex items-center gap-2 px-4 py-2">
          <Flame className="size-4 text-gold" />
          <span className="text-sm font-semibold">5-day streak</span>
        </div>
        <div className="glass-card flex items-center gap-3 px-4 py-2">
          <span className="grid size-7 place-items-center rounded-full bg-gold/20 font-display text-xs font-bold text-gold ring-1 ring-gold/40">
            1
          </span>
          <span className="text-sm">
            <span className="font-semibold">adminns</span>{" "}
            <span className="text-muted-foreground">· 2,480 XP</span>
          </span>
        </div>
        <div className="glass-card flex items-center gap-3 px-4 py-2">
          <span className="grid size-7 place-items-center rounded-full bg-muted/50 font-display text-xs font-bold text-muted-foreground">
            2
          </span>
          <span className="text-sm text-muted-foreground">2,110 XP</span>
        </div>
      </ScrollReveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 6. Final CTA                                                         */
/* ------------------------------------------------------------------ */

function FinalCta() {
  return (
    <section className="relative mx-auto w-full max-w-4xl px-5 py-24 sm:px-8">
      <ScrollReveal>
        <div className="glass-card glow-ring relative overflow-hidden px-6 py-12 text-center sm:px-12">
          <Ambience density={10} intensity="soft" />
          <div className="relative">
            <StudlyLogo className="mx-auto h-10" />
            <h2 className="mt-6 font-display text-2xl font-bold sm:text-4xl">Start watching tonight.</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Your first series is free. Drop a topic, press play, and let Susu handle the rest.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="cta-studio cta-sheen press h-12 rounded-full px-7 text-sm font-semibold">
                <Link to="/signup">Create your first series</Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="press h-12 rounded-full px-7 text-sm font-semibold">
                <Link to="/login">I already study here</Link>
              </Button>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Studly — Binge-worthy AI study series" },
      {
        name: "description",
        content:
          "Studly turns any topic, PDF or lecture into episodes, pop-up quizzes and flashcards, with Susu the AI tutor guiding you.",
      },
      { property: "og:title", content: "Studly — Binge-worthy AI study series" },
      {
        property: "og:description",
        content: "Turn any topic into episodes, quizzes and flashcards with Susu, your AI study coach.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <Ambience density={20} />

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <StudlyLogo className="h-9" />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" className="press rounded-full text-sm font-semibold">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild className="press glow-ring rounded-full text-sm font-semibold">
            <Link to="/signup">Get started</Link>
          </Button>
        </nav>
      </header>

      <section className="relative mx-auto w-full max-w-3xl px-5 pt-16 pb-10 text-center sm:px-8 sm:pt-24">
        <ScrollReveal>
          <h1 className="font-sans text-3xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            Make studying <span className="text-gradient">hit different.</span>
          </h1>
        </ScrollReveal>
        <RotatingSubtitle />
        <ScrollReveal delay={0.24}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="cta-studio cta-sheen press h-12 rounded-full px-7 text-sm font-semibold">
              <Link to="/signup">Create your first series</Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="press h-12 rounded-full px-7 text-sm font-semibold">
              <Link to="/login">I already study here</Link>
            </Button>
          </div>
        </ScrollReveal>

        <HeroPreview />
      </section>

      <CoverShelf />
      <HowItWorks />
      <SusuSpotlight />
      <LeaguesShowcase />
      <FinalCta />

      <footer className="relative mx-auto w-full max-w-6xl px-5 pb-10 pt-4 sm:px-8">
        <div className="flex flex-col items-center gap-2 border-t border-border pt-6 text-center">
          <StudlyLogo className="h-7" />
          <p className="text-xs text-muted-foreground">The Netflix of studying. Built for the curious.</p>
        </div>
      </footer>
    </main>
  );
}
