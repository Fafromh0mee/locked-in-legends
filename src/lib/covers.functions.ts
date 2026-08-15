import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type CoverInput = {
  seriesId: string;
  title: string;
  subject?: string;
  topic?: string;
};

const YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Generates a cinematic cover image for a series and stores it on the series row. */
export const generateSeriesCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CoverInput) => input)
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { coverUrl: null as string | null };

    const prompt = [
      `Cinematic poster artwork for an educational series titled "${data.title}".`,
      data.subject ? `Subject: ${data.subject}.` : "",
      data.topic ? `Topic: ${data.topic}.` : "",
      "Dreamy dark editorial illustration, deep charcoal background, soft muted purple and violet light,",
      "glowing atmospheric haze, elegant symbolic imagery of the subject, no text, no words, no letters,",
      "no watermark, wide 16:9 composition, premium streaming-service cover art.",
    ]
      .filter(Boolean)
      .join(" ");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) return { coverUrl: null as string | null };

    const body = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const b64 = body.data?.[0]?.b64_json;
    if (!b64) return { coverUrl: null as string | null };

    const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `${context.userId}/${data.seriesId}.png`;

    const { error: uploadError } = await context.supabase.storage
      .from("series-covers")
      .upload(path, binary, { contentType: "image/png", upsert: true });
    if (uploadError) return { coverUrl: null as string | null };

    const { data: signed } = await context.supabase.storage
      .from("series-covers")
      .createSignedUrl(path, YEAR_SECONDS);
    const coverUrl = signed?.signedUrl ?? null;
    if (!coverUrl) return { coverUrl: null as string | null };

    await context.supabase.from("series").update({ cover_url: coverUrl }).eq("id", data.seriesId);
    return { coverUrl };
  });
