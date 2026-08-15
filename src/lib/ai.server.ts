const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
};

/** Calls Lovable AI and returns the assistant text. Keys stay server-side. */
export async function chat(messages: ChatMessage[], opts?: { model?: string; json?: boolean }) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured yet.");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: opts?.model ?? "google/gemini-2.5-flash",
      messages,
      ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    if (res.status === 429) throw new Error("The tutor is busy right now — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits are used up for now.");
    throw new Error(`AI request failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return body.choices?.[0]?.message?.content ?? "";
}

/** Parses a JSON object out of a model reply, tolerating code fences and stray prose. */
export function parseJson<T>(text: string): T {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new Error("The AI reply could not be read. Try again.");
  }
}
