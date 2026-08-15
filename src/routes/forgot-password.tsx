import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your Studly password" },
      { name: "description", content: "Send yourself a secure link to choose a new Studly password." },
      { property: "og:title", content: "Reset your Studly password" },
      { property: "og:description", content: "Send yourself a secure link to choose a new password." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Reset link sent.");
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter the email on your account and we'll send you a link to set a new password."
      footer={
        <>
          Remembered it?{" "}
          <Link to="/login" className="underline-sweep font-semibold text-primary">
            Back to log in
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="animate-pop-in rounded-2xl border border-border bg-surface p-6 text-center">
          <MailCheck className="mx-auto size-8 text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{email}</span>, a reset link is on
            its way.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
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
          <Button type="submit" disabled={busy} className="press h-11 w-full rounded-xl text-sm font-semibold">
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
