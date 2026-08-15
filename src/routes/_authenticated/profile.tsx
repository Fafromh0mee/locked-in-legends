import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2, Save, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Reveal } from "@/components/motion/Reveal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { moderateImage } from "@/lib/moderation.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your Studly profile — XP, league and badges" },
      { name: "description", content: "Update your Studly display name, bio and avatar, and track your XP." },
      { property: "og:title", content: "Your Studly profile" },
      { property: "og:description", content: "Update your details and track your XP, league and badges." },
    ],
  }),
  component: ProfilePage,
});

/** Reads an image file as a data URL for server-side moderation. */
function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

function ProfilePage() {
  const { profile, user, refreshProfile } = useAuth();
  const review = useServerFn(moderateImage);
  const fileInput = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setBio(profile?.bio ?? "");
  }, [profile?.display_name, profile?.bio]);

  useEffect(() => {
    let active = true;
    async function loadAvatar() {
      if (!profile?.avatar_path) {
        setAvatarUrl(profile?.avatar_url ?? null);
        return;
      }
      const { data } = await supabase.storage.from("avatars").createSignedUrl(profile.avatar_path, 3600);
      if (active) setAvatarUrl(data?.signedUrl ?? null);
    }
    void loadAvatar();
    return () => {
      active = false;
    };
  }, [profile?.avatar_path, profile?.avatar_url]);

  async function onSave() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null, bio: bio.trim() || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("We couldn't save your profile.");
      return;
    }
    await refreshProfile();
    toast.success("Profile updated.");
  }

  async function onAvatarSelected(file: File) {
    if (!user) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Images need to be under 25MB.");
      return;
    }
    setUploading(true);

    try {
      const dataUrl = await readAsDataUrl(file);
      const verdict = await review({ data: { dataUrl } });
      if (!verdict.safe) {
        setUploading(false);
        toast.error(verdict.reason || "That image isn't allowed as a profile picture.");
        return;
      }
    } catch {
      setUploading(false);
      toast.error("We couldn't check that image. Try another one.");
      return;
    }

    const ext = file.name.split(".").pop() ?? "png";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadError) {
      setUploading(false);
      toast.error("Upload failed. Try a different image.");
      return;
    }
    const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_path: path, avatar_url: signed?.signedUrl ?? null })
      .eq("id", user.id);
    setUploading(false);
    if (error) {
      toast.error("We couldn't attach that avatar.");
      return;
    }
    await refreshProfile();
    toast.success("New avatar saved.");
  }

  const initials = (profile?.display_name || profile?.username || "S").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 lg:py-14">
      <Reveal>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Your profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This is how classmates see you on leaderboards and public student profiles.
        </p>
      </Reveal>

      <Reveal delay={0.08} className="mt-8">
        <div className="glass-card p-7 sm:p-9">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="relative w-fit">
              <Avatar className="size-24 ring-2 ring-primary/30">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt="Your avatar" /> : null}
                <AvatarFallback className="bg-primary/15 text-xl font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                aria-label="Change avatar"
                className="press absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-glow-sm"
              >
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onAvatarSelected(file);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="min-w-0">
              <p className="font-display text-2xl font-semibold">
                {profile?.display_name || profile?.username || "Student"}
              </p>
              <p className="text-sm text-muted-foreground">@{profile?.username}</p>
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkles className="size-3.5" />
                {profile?.xp ?? 0} XP
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-5">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={40}
                className="h-11 rounded-xl bg-surface"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={280}
                rows={4}
                placeholder="What are you studying right now?"
                className="rounded-xl bg-surface"
              />
            </div>
            <Button onClick={onSave} disabled={saving} className="press w-fit rounded-xl font-semibold">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save changes
            </Button>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
