import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clapperboard, Flame, Layers, PlayCircle, Sparkles, Target, Trophy } from "lucide-react";

import { Floaty, Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { trophyFor } from "@/lib/trophies";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Your Studly dashboard — streaks, XP and episodes" },
      {
        name: "description",
        content: "See your streak, XP, league and next episode at a glance, then jump back into studying.",
      },
      { property: "og:title", content: "Your Studly dashboard" },
      { property: "og:description", content: "Streaks, XP, leagues and your next episode in one calm place." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { profile, user } = useAuth();

  const { data: streak } = useQuery({
    queryKey: ["streak", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data } = await supabase
        .from("streaks")
        .select("current_streak, longest_streak, last_activity_date")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: league } = useQuery({
    queryKey: ["league", profile?.league_id],
    enabled: Boolean(profile?.league_id),
    queryFn: async () => {
      const { data } = await supabase
        .from("leagues")
        .select("name, tier")
        .eq("id", profile!.league_id!)
        .maybeSingle();
      return data;
    },
  });

  const trophy = trophyFor(league?.tier);
  const xp = profile?.xp ?? 0;
  const levelXp = xp % 500;
  const level = Math.floor(xp / 500) + 1;

  const stats = [
    {
      label: "Day streak",
      value: streak?.current_streak ?? 0,
      icon: Flame,
      hint: `Best: ${streak?.longest_streak ?? 0} days`,
    },
    { label: "Total XP", value: xp, icon: Sparkles, hint: `Level ${level}` },
    { label: "Episodes done", value: profile?.episodes_completed ?? 0, icon: PlayCircle, hint: "Keep bingeing" },
    { label: "Correct answers", value: profile?.correct_answers ?? 0, icon: Target, hint: "Quiz accuracy grows" },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 lg:py-14">
      <Reveal>
        <p className="text-sm font-medium text-muted-foreground">
          {greeting()}, {profile?.display_name || profile?.username || "student"}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Ready for your next <span className="text-gradient">episode</span>?
        </h1>
      </Reveal>

      <Reveal delay={0.08} className="mt-8">
        <div className="glass-card glow-ring relative overflow-hidden p-7 sm:p-9">
          <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-lg">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                <Trophy className="size-3.5" />
                {league?.name ?? "Bronze"} league
              </span>
              <h2 className="mt-4 font-display text-2xl font-semibold">Level {level}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {500 - levelXp} XP to your next level. Finish an episode or ace a pop quiz to move up.
              </p>
              <Progress value={(levelXp / 500) * 100} className="mt-5 h-2 bg-surface-2" />
              <div className="mt-6 flex flex-wrap gap-2">
                <Button
                  asChild
                  className="press cta-studio cta-sheen h-11 gap-2 rounded-2xl px-5 font-semibold hover:brightness-110"
                >
                  <Link to="/create">
                    <Clapperboard className="relative z-[2] size-4" />
                    <span className="relative z-[2]">Create a series</span>
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="press h-11 rounded-2xl px-5">
                  <Link to="/episodes">
                    <PlayCircle className="mr-1.5 size-4" /> Start an episode
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="press h-11 rounded-2xl px-5">
                  <Link to="/leagues">View league</Link>
                </Button>
              </div>

            </div>
            <Floaty className="shrink-0">
              <div className="grid size-28 place-items-center rounded-full bg-primary/15 ring-1 ring-primary/30">
                <img src={trophy.url} alt={`${league?.name ?? "Bronze"} league trophy`} className="h-16 w-auto" />
              </div>
            </Floaty>

          </div>
        </div>
      </Reveal>

      <RevealGroup className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <RevealItem key={stat.label}>
            <div className="glass-card lift h-full p-5">
              <stat.icon className="size-5 text-primary" />
              <p className="mt-4 font-display text-2xl font-semibold">{stat.value}</p>
              <p className="text-sm font-medium text-foreground/90">{stat.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>

      <RevealGroup className="mt-6 grid gap-4 lg:grid-cols-3" delay={0.05}>
        {[
          {
            title: "Create a series",
            body: "Turn a topic, PDF, deck or video into a season of episodes.",
            icon: Sparkles,
          },
          { title: "Study flashcards", body: "AI-built decks with flip-card practice and progress.", icon: Layers },
          { title: "Pop quizzes", body: "Timed questions that appear mid-episode with instant hints.", icon: Target },
        ].map((card) => (
          <RevealItem key={card.title}>
            <div className="glass-card lift flex h-full flex-col p-6">
              <card.icon className="size-5 text-primary" />
              <h3 className="mt-4 font-display text-lg font-semibold">{card.title}</h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{card.body}</p>
              <Button variant="secondary" className="press mt-5 w-fit rounded-full text-xs font-semibold" disabled>
                Coming next
              </Button>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>
    </div>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
