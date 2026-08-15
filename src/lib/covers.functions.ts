import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type CoverInput = {
  seriesId: string;
  title: string;
  subject?: string;
  topic?: string;
};

const coverSchema = z.object({
  seriesId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  subject: z.string().trim().max(120).optional(),
  topic: z.string().trim().max(200).optional(),
});

/** Claude does not provide image output, so cover generation uses the app's existing fallback art. */
export const generateSeriesCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => coverSchema.parse(input) as CoverInput)
  .handler(async () => {
    return { coverUrl: null as string | null };
  });
