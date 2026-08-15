import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { isUsernameAvailable } from "@/lib/auth.functions";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your Studly account — Learn with Susu" },
      {
        name: "description",
        content:
          "Join Studly: turn any topic, PDF or slide deck into binge-worthy episodes, quizzes and flashcards with an AI tutor.",
      },
      { property: "og:title", content: "Create your Studly account" },
      {
        property: "og:description",
        content: "Turn any topic into episodes, quizzes and flashcards with Susu, your AI study coach.",
      },
    ],
  }),
  component: SignupPage,
});

const USERNAME_RE = /^[a-zA-Z0-9._]{3,24}$/;

function SignupPage() {
  const navigate = useNavigate();
  const checkUsername = useServerFn(isUsernameAvailable);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    const cleanUsername = username.trim().toLowerCase();
    if (!USERNAME_RE.test(cleanUsername)) {
      toast.error("Usernames use 3–24 letters, numbers, dots or underscores.");
      return;
    }
    if (password.length < 8) {
      toast.error("Use at least 8 characters for your password.");
      return;
    }

    setBusy(true);
    try {
      const { available } = await checkUsername({ data: { username: cleanUsername } });
      if (!available) {
        toast.error("That username is taken. Try another one.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/home`,
          data: { username: cleanUsername, display_name: displayName.trim() || cleanUsername },
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data.session || !data.user) {
        toast.success("Check your inbox to confirm your email, then log in.");
        await navigate({ to: "/login" });
        return;
      }

      const { error: profileError } = await supabase.from("profiles").insert({
        id: data.user.id,
        username: cleanUsername,
        display_name: displayName.trim() || cleanUsername,
      });
      if (profileError && profileError.code !== "23505") {
        toast.error("Your account was created, but we couldn't save your profile yet.");
      }

      toast.success("Welcome to Studly!");
      await navigate({ to: "/home" });
    } catch {
      toast.error("Something went wrong creating your account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Start your first series"
      subtitle="Create an account to unlock episodes, pop-up quizzes, flashcards and Susu, your AI tutor."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="underline-sweep font-semibold text-primary">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="studious.sam"
              className="h-11 rounded-xl bg-surface"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Sam"
              className="h-11 rounded-xl bg-surface"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="sam@school.edu"
            className="h-11 rounded-xl bg-surface"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="h-11 rounded-xl bg-surface"
          />
        </div>
        <Button type="submit" disabled={busy} className="press h-11 w-full rounded-xl text-sm font-semibold">
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
