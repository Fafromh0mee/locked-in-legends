import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { signInWithIdentifier } from "@/lib/auth.functions";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search["redirect"] === "string" ? { redirect: search["redirect"] as string } : {},
  head: () => ({
    meta: [
      { title: "Log in to Studly — Your AI study companion" },
      {
        name: "description",
        content: "Sign in to Studly to keep your streak alive, watch episodes and study with Susu, your AI tutor.",
      },
      { property: "og:title", content: "Log in to Studly" },
      { property: "og:description", content: "Sign in to keep learning with Susu, your AI study coach." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });
  const signIn = useServerFn(signInWithIdentifier);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const result = await signIn({ data: { identifier: identifier.trim(), password } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { error } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      if (error) {
        toast.error("We couldn't start your session. Please try again.");
        return;
      }
      toast.success("Welcome back!");
      const target = search.redirect && search.redirect.startsWith("/") ? search.redirect : "/home";
      await navigate({ to: target });
    } catch {
      toast.error("Something went wrong signing you in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in with your username or email to pick up where you left off."
      footer={
        <>
          New to Studly?{" "}
          <Link to="/signup" className="underline-sweep font-semibold text-primary">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="identifier">Username or email</Label>
          <Input
            id="identifier"
            autoComplete="username"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="studious.sam"
            className="h-11 rounded-xl bg-surface"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary">
              Forgot?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="h-11 rounded-xl bg-surface"
          />
        </div>
        <Button type="submit" disabled={busy} className="press h-11 w-full rounded-xl text-sm font-semibold">
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Log in"}
        </Button>
      </form>
    </AuthShell>
  );
}
