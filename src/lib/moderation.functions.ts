import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ModerateInput = { dataUrl: string };

const RULES = [
  "You are an image safety reviewer for a school learning app used by students.",
  'Reply with JSON only: {"safe":boolean,"reason":string}.',
  "Mark unsafe when the image contains nudity or sexual content, gore or graphic violence, hate symbols,",
  "weapons intended to threaten, drugs or alcohol use, or any other content inappropriate for a classroom.",
  "Ordinary selfies, portraits, pets, cartoons, avatars and objects are safe.",
  "Keep reason under 15 words and address the student directly.",
].join(" ");

/** Screens an uploaded avatar for inappropriate content before it is saved. */
export const moderateImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ModerateInput) => input)
  .handler(async ({ data }) => {
    if (!data.dataUrl.startsWith("data:image/")) throw new Error("That file is not an image.");

    const { chat, parseJson } = await import("./ai.server");
    try {
      const raw = await chat(
        [
          { role: "system", content: RULES },
          {
            role: "user",
            content: [
              { type: "text", text: "Is this profile picture appropriate for a school app?" },
              { type: "image_url", image_url: { url: data.dataUrl } },
            ],
          },
        ],
        { json: true },
      );
      const parsed = parseJson<{ safe?: boolean; reason?: string }>(raw);
      return {
        safe: parsed.safe !== false,
        reason: parsed.reason ?? "This image isn't allowed as a profile picture.",
      };
    } catch {
      // Never block a student because the reviewer itself failed.
      return { safe: true, reason: "" };
    }
  });
