import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const credentials = z.object({
  identifier: z.string().min(2).max(200),
  password: z.string().min(6).max(200),
});

/**
 * Signs a student in with either their email address or their username.
 * Username -> email resolution happens entirely on the server so no email
 * address is ever exposed to the browser; the session is only returned when
 * the password is correct.
 */
export const signInWithIdentifier = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => credentials.parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env["SUPABASE_URL"]!;
    const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"]!;

    let email = data.identifier.trim().toLowerCase();

    if (!email.includes("@")) {
      if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
        return { ok: false as const, error: "Username login is not configured locally. Use your email instead." };
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("username", email)
        .maybeSingle();

      if (!profile) {
        return { ok: false as const, error: "We couldn't find an account with those details." };
      }

      const { data: userResult } = await supabaseAdmin.auth.admin.getUserById(profile.id);
      if (!userResult?.user?.email) {
        return { ok: false as const, error: "We couldn't find an account with those details." };
      }
      email = userResult.user.email;
    }

    const authClient = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (headers.get("Authorization") === `Bearer ${publishableKey}`) headers.delete("Authorization");
          headers.set("apikey", publishableKey);
          return fetch(input, { ...init, headers });
        },
      },
    });

    const { data: session, error } = await authClient.auth.signInWithPassword({
      email,
      password: data.password,
    });

    if (error || !session.session) {
      return { ok: false as const, error: "Incorrect username, email or password." };
    }

    return {
      ok: true as const,
      access_token: session.session.access_token,
      refresh_token: session.session.refresh_token,
    };
  });

/** Checks whether a username is still free (case-insensitive) before signup. */
export const isUsernameAvailable = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ username: z.string().min(3).max(24) }).parse(data))
  .handler(async ({ data }) => {
    if (!process.env["SUPABASE_URL"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
      return { available: true, checked: false };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const username = data.username.trim().toLowerCase();
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();
    return { available: !existing, checked: true };
  });
