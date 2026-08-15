import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Flame, Info } from "lucide-react";
import { useMemo, useState } from "react";

import { Ambience } from "@/components/motion/Ambience";
import { Reveal } from "@/components/motion/Reveal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { trophyFor } from "@/lib/trophies";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/leagues")({
  head: () => ({
    meta: [
      { title: "Leagues — climb from Bronze to Diamond | Studly" },
      {
        name: "description",
        content: "Two-week seasons, live XP rankings and promotions. See where you stand in your Studly league.",
      },
      { property: "og:title", content: "Studly leagues" },
      { property: "og:description", content: "Earn XP, climb the leaderboard and take the next trophy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeaguesPage,
});

const PROMOTE_COUNT = 7;

const MEDALS: Record<1 | 2 | 3, string> = {
  1: "bg-gradient-to-br from-amber-200 to-yellow-500 ring-amber-200/60",
  2: "bg-gradient-to-br from-slate-100 to-slate-400 ring-slate-200/60",
  3: "bg-gradient-to-br from-orange-200 to-amber-700 ring-orange-300/50",
};

function LeaguesPage() {
  const { profile, user } = useAuth();
  const [showRules, setShowRules] = useState(false);

  const { data } = useQuery({
    queryKey: ["leagues-board", profile?.league_id],
    queryFn: async () => {
      const [{ data: leagues }, { data: season }] = await Promise.all([
        supabase.from("leagues").select("id, name, tier, slug").order("tier", { ascending: true }),
        supabase
          .from("league_seasons")
          .select("id, starts_at, ends_at")
          .eq("is_active", true)
          .order("starts_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const leagueId = profile?.league_id ?? leagues?.[0]?.id ?? null;
      let entries: { user_id: string; xp: number }[] = [];
      if (season?.id && leagueId) {
        const { data: rows } = await supabase
          .from("leaderboard_entries")
          .select("user_id, xp")
          .eq("season_id", season.id)
          .eq("league_id", leagueId)
          .order("xp", { ascending: false })
          .limit(30);
        entries = rows ?? [];
      }

      const ids = entries.map((e) => e.user_id);
      const { data: people } = ids.length
        ? await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url, hidden_from_rankings")
            .in("id", ids)
        : { data: [] as never[] };

      const { data: streaks } = ids.length
        ? await supabase.from("streaks").select("user_id, current_streak").in("user_id", ids)
        : { data: [] as never[] };

      return { leagues: leagues ?? [], season, entries, people: people ?? [], streaks: streaks ?? [], leagueId };
    },
  });

  const league = data?.leagues.find((l) => l.id === data?.leagueId) ?? data?.leagues[0];
  const trophy = trophyFor(league?.tier);

  const board = useMemo(() => {
    const byId = new Map((data?.people ?? []).map((p) => [p.id, p]));
    const streakById = new Map((data?.streaks ?? []).map((s) => [s.user_id, s.current_streak]));
    return (data?.entries ?? [])
      .map((e) => ({ ...e, person: byId.get(e.user_id), streak: streakById.get(e.user_id) ?? 0 }))
      .filter((e) => e.person && !e.person.hidden_from_rankings)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }, [data]);

  const daysLeft = data?.season?.ends_at
    ? Math.max(0, Math.ceil((new Date(data.season.ends_at).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <div className="relative mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 lg:py-14">
      <Ambience intensity="soft" className="fixed" />

      <Button asChild variant="ghost" size="icon" className="press mb-4 rounded-xl">
        <Link to="/home" aria-label="Back to dashboard">
          <ArrowLeft className="size-4" />
        </Link>
      </Button>

      <Reveal>
        <div className="flex items-end justify-center gap-3 sm:gap-6">
          {(data?.leagues ?? []).map((l) => {
            const t = trophyFor(l.tier);
            const active = l.id === league?.id;
            const reached = (l.tier ?? 1) <= (league?.tier ?? 1);
            return (
              <motion.img
                key={l.id}
                src={t.url}
                alt={`${l.name} league trophy`}
                loading="lazy"
                animate={active ? { y: [0, -6, 0] } : { y: 0 }}
                transition={{ duration: 4.5, repeat: active ? Infinity : 0, ease: "easeInOut" }}
                className={cn(
                  "h-12 w-auto transition sm:h-16",
                  active ? "scale-125 sm:scale-110" : "opacity-45",
                  !reached && "opacity-20 grayscale",
                )}
                style={{ ...(active ? { filter: `drop-shadow(0 0 14px ${t.glow})` } : {}) }}

              />
            );
          })}
        </div>

        <div className="mt-7 text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{league?.name ?? "Bronze"} League</h1>
          <p className="mt-2 text-sm text-muted-foreground">Top {PROMOTE_COUNT} advance to the next league</p>
          {daysLeft !== null && (
            <p className="mt-1 font-display text-sm font-semibold text-primary">
              {daysLeft} {daysLeft === 1 ? "day" : "days"} left
            </p>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="press mt-2 rounded-xl text-xs text-muted-foreground"
            onClick={() => setShowRules((v) => !v)}
          >
            <Info className="mr-1.5 size-3.5" /> How seasons work
          </Button>
        </div>

        <AnimatePresence>
          {showRules && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 rounded-2xl border border-border/60 bg-card/70 p-4 text-sm text-muted-foreground backdrop-blur-xl">
                Seasons run for two weeks. XP from episodes, correct quiz answers and perfect runs counts toward your
                league standing. Finish in the top {PROMOTE_COUNT} to be promoted; the bottom of the table drops a tier.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Reveal>

      <div className="mt-9 overflow-hidden rounded-3xl border border-border/60 bg-card/60 backdrop-blur-xl">
        {board.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No XP in this season yet. Finish an episode to claim first place.
          </p>
        )}
        {board.map((row, i) => {
          const me = row.user_id === user?.id;
          const promo = row.rank <= PROMOTE_COUNT;
          const name = row.person?.display_name || row.person?.username || "Student";
          return (
            <motion.div
              key={row.user_id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.35 }}
              className={cn(
                "flex items-center gap-3 border-b border-border/40 px-4 py-3.5 last:border-b-0 sm:px-5",
                me && "bg-primary/10",
                promo && !me && "bg-primary/[0.04]",
              )}
            >
              {row.rank <= 3 ? (
                <span
                  aria-label={`Rank ${row.rank}`}
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full font-display text-xs font-bold text-background shadow-glow-sm ring-1",
                    MEDALS[row.rank as 1 | 2 | 3],
                  )}
                >
                  {row.rank}
                </span>
              ) : (
                <span
                  className={cn(
                    "w-7 shrink-0 text-center font-display text-base font-bold",
                    promo ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {row.rank}
                </span>
              )}
              <Avatar
                className={cn(
                  "size-10 shrink-0 ring-1 ring-border/60",
                  row.rank === 1 && "ring-2 ring-amber-300/70",
                  row.rank === 2 && "ring-2 ring-slate-300/70",
                  row.rank === 3 && "ring-2 ring-orange-400/60",
                )}
              >
                {row.person?.avatar_url && <AvatarImage src={row.person.avatar_url} alt={`${name} profile picture`} className="object-cover" />}
                <AvatarFallback className="text-xs font-semibold">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm font-semibold", me && "text-primary")}>
                  {name} {me && <span className="text-xs font-medium text-muted-foreground">· you</span>}
                </span>
                {row.streak > 0 && (
                  <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-orange-400">
                    <Flame className="size-3.5" /> {row.streak} day streak
                  </span>
                )}
              </span>
              <span className="shrink-0 font-display text-sm font-bold tabular-nums">{row.xp} XP</span>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-center gap-3 rounded-3xl border border-border/60 bg-card/60 p-5 backdrop-blur-xl">
        <img src={trophy.url} alt={`${league?.name} trophy`} className="h-12 w-auto" loading="lazy" />
        <p className="text-sm text-muted-foreground">
          You have <span className="font-display font-bold text-foreground">{profile?.xp ?? 0} XP</span> in total. Keep
          the streak alive to hold your place.
        </p>
      </div>
    </div>
  );
}
