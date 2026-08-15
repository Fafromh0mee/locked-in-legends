import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowLeft, ImagePlus, Loader2, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Ambience } from "@/components/motion/Ambience";
import { Reveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { uploadCastPhotos } from "@/lib/cast";

export const Route = createFileRoute("/_authenticated/cast")({
  head: () => ({
    meta: [
      { title: "Your cast — the actors in your lessons | Studly" },
      {
        name: "description",
        content: "Add cast members with reference photos so your generated series stars the same characters every episode.",
      },
      { property: "og:title", content: "Studly cast" },
      { property: "og:description", content: "Name your actors, add reference photos and reuse them across every series." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CastPage,
});

function CastPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const { data: cast } = useQuery({
    queryKey: ["cast", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("characters")
        .select("id, name, role_description, image_urls")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first.");
      if (!name.trim()) throw new Error("Give your cast member a name.");
      const uploaded = await uploadCastPhotos(user.id, files);
      const { error } = await supabase.from("characters").insert({
        owner_id: user.id,
        name: name.trim(),
        role_description: role.trim() || null,
        image_paths: uploaded.paths,
        image_urls: uploaded.urls,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setName("");
      setRole("");
      setFiles([]);
      toast.success("Cast member added");
      await queryClient.invalidateQueries({ queryKey: ["cast", user?.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add that cast member."),
  });

  async function remove(id: string) {
    await supabase.from("characters").delete().eq("id", id);
    await queryClient.invalidateQueries({ queryKey: ["cast", user?.id] });
  }

  return (
    <div className="relative mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 lg:py-14">
      <Ambience intensity="soft" className="fixed" />

      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="press rounded-xl">
          <Link to="/home" aria-label="Back to dashboard">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Your cast</h1>
          <p className="text-sm text-muted-foreground">Actors and reference photos reused across every series you make.</p>
        </div>
      </div>

      <Reveal className="mt-8 rounded-3xl border border-border/60 bg-card/70 p-6 backdrop-blur-xl">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Professor Nam)" className="h-11 rounded-2xl" />
          <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role (e.g. curious student)" className="h-11 rounded-2xl" />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="press inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-border/60 bg-background/50 px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary/50">
            <ImagePlus className="size-4" /> Add reference photos
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
            />
          </label>
          {files.map((f) => (
            <span key={f.name} className="rounded-full bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary">
              {f.name}
            </span>
          ))}
        </div>

        <Button className="press glow-ring mt-4 h-11 rounded-2xl" onClick={() => add.mutate()} disabled={add.isPending}>
          {add.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <UserPlus className="mr-1.5 size-4" />}
          Add to cast
        </Button>
      </Reveal>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {(cast ?? []).map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: Math.min(i * 0.05, 0.3) }}
            className="flex items-center gap-4 rounded-3xl border border-border/60 bg-card/60 p-4 backdrop-blur-xl"
          >
            <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary/15 font-display text-lg font-bold text-primary">
              {c.image_urls?.[0] ? (
                <img src={c.image_urls[0]} alt={c.name} className="size-full object-cover" loading="lazy" />
              ) : (
                c.name.slice(0, 2).toUpperCase()
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{c.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {c.role_description ?? "No role yet"} · {c.image_urls?.length ?? 0} photo(s)
              </span>
            </span>
            <Button variant="ghost" size="icon" className="press rounded-xl" aria-label={`Delete ${c.name}`} onClick={() => void remove(c.id)}>
              <Trash2 className="size-4" />
            </Button>
          </motion.div>
        ))}
        {(cast ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No cast members yet — add one above and they can star in your next series.</p>
        )}
      </div>
    </div>
  );
}
