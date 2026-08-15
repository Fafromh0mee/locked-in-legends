import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Clock, Play, Sparkles } from "lucide-react";

import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { DeleteSeriesButton } from "@/components/series/DeleteSeriesButton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/series/$seriesId")({
  head: () => ({
    meta: [
      { title: "Series episodes — keep the binge going | Studly" },
      { name: "description", content: "Every episode in this Studly series, with your progress and next stop." },
      { property: "og:title", content: "Studly series" },
      { property: "og:description", content: "Slides, takeaways and pop quizzes, episode by episode." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SeriesPage,
});

function SeriesPage() {
  const { seriesId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["series", seriesId],
    queryFn: async () => {
      const [{ data: series }, { data: episodes }] = await Promise.all([
        supabase
          .from("series")
          .select("id, title, description, subject, cover_gradient, cover_url, owner_id, episode_count")
          .eq("id", seriesId)
          .maybeSingle(),
        supabase
          .from("episodes")
          .select("id, title, synopsis, order_index, duration_seconds")
          .eq("series_id", seriesId)
          .order("order_index", { ascending: true }),
      ]);
      return { series, episodes: episodes ?? [] };
    },
  });

  const { data: progress } = useQuery({
    queryKey: ["progress-series", seriesId, user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("progress")
        .select("episode_id, completed, last_slide_index")
        .eq("user_id", user!.id)
        .eq("series_id", seriesId);
      return rows ?? [];
    },
  });

  const state = new Map((progress ?? []).map((p) => [p.episode_id, p]));
  const series = data?.series;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 lg:py-14">
      <Reveal>
        <div className="flex items-center justify-between gap-2">
          <Button asChild variant="ghost" size="sm" className="press -ml-2 rounded-xl text-muted-foreground">
            <Link to="/episodes">
              <ArrowLeft className="mr-1 size-4" /> All series
            </Link>
          </Button>
          {series && series.owner_id === user?.id && (
            <DeleteSeriesButton
              seriesId={series.id}
              title={series.title}
              variant="button"
              onDeleted={() => navigate({ to: "/episodes" })}
            />
          )}
        </div>

        <div
          className={cn(
            "relative mt-4 overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br p-7",
            series?.cover_gradient ?? "from-primary/40 to-accent/20",
          )}
        >
          {series?.cover_url && (
            <>
              <img
                src={series.cover_url}
                alt={`Cover art for ${series.title}`}
                className="absolute inset-0 size-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/60 to-background/25" />
            </>
          )}
          <div className="relative">
            <span className="rounded-full bg-background/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/80 backdrop-blur-md">
              {series?.subject ?? "Studly"}
            </span>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {series?.title ?? "Series"}
            </h1>
            <p className="mt-2 max-w-lg text-sm text-foreground/80">{series?.description}</p>
          </div>
        </div>
      </Reveal>

      <RevealGroup className="mt-8 space-y-3">
        {(data?.episodes ?? []).map((ep) => {
          const p = state.get(ep.id);
          return (
            <RevealItem key={ep.id}>
              <Link
                to="/watch/$episodeId"
                params={{ episodeId: ep.id }}
                className="press flex items-center gap-4 rounded-2xl border border-border/60 bg-card/70 p-4 backdrop-blur-xl transition-shadow hover:shadow-glow-sm"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 font-display text-sm font-bold text-primary">
                  {p?.completed ? <CheckCircle2 className="size-5" /> : ep.order_index}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-base font-semibold">{ep.title}</span>
                  <span className="mt-0.5 block truncate text-sm text-muted-foreground">{ep.synopsis}</span>
                </span>
                <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                  <Clock className="size-3.5" />
                  {Math.round((ep.duration_seconds ?? 300) / 60)} min
                </span>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/90 text-primary-foreground">
                  <Play className="size-4" />
                </span>
              </Link>
            </RevealItem>
          );
        })}
      </RevealGroup>

      {(data?.episodes ?? []).length === 0 && (
        <p className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="size-4 text-primary" /> No episodes in this series yet.
        </p>
      )}
    </div>
  );
}
