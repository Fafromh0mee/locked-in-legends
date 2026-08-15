const CLAUDE_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_API_VERSION = "2023-06-01";
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-5";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
};

type ClaudeContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "url"; url: string } | { type: "base64"; media_type: string; data: string };
    };

function systemText(content: ChatMessage["content"]) {
  if (typeof content === "string") return content;
  return content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function imageSource(url: string): ClaudeContentBlock["source"] {
  const dataUrl = /^data:([^;,]+);base64,(.+)$/s.exec(url);
  if (dataUrl) {
    return { type: "base64", media_type: dataUrl[1]!, data: dataUrl[2]! };
  }
  return { type: "url", url };
}

function claudeContent(content: ChatMessage["content"]): string | ClaudeContentBlock[] {
  if (typeof content === "string") return content;
  return content.map((part) => {
    if (part.type === "text") return { type: "text", text: part.text };
    return { type: "image", source: imageSource(part.image_url.url) };
  });
}

function claudeErrorMessage(status: number, detail: string) {
  if (status === 401 || status === 403) return "Claude API key is invalid or does not have access.";
  if (status === 429) return "The tutor is busy right now — try again in a moment.";
  if (status === 402) return "AI credits are used up for now.";
  return `AI request failed (${status}): ${detail.slice(0, 200)}`;
}

/** Calls Claude and returns the assistant text. Keys stay server-side. */
export async function chat(messages: ChatMessage[], opts?: { model?: string; json?: boolean; maxTokens?: number }) {
  const key = process.env["ANTHROPIC_API_KEY"] ?? process.env["CLAUDE_API_KEY"];
  if (!key) throw new Error("Claude API is not configured yet.");

  const systemMessages: string[] = [];
  const claudeMessages: Array<{ role: "user" | "assistant"; content: string | ClaudeContentBlock[] }> = [];

  for (const message of messages) {
    if (message.role === "system") {
      const text = systemText(message.content).trim();
      if (text) systemMessages.push(text);
      continue;
    }
    claudeMessages.push({ role: message.role, content: claudeContent(message.content) });
  }

  if (opts?.json) systemMessages.push("Return only valid JSON. Do not include markdown, prose, or code fences.");
  if (!claudeMessages.length) throw new Error("Claude needs at least one user or assistant message.");

  const res = await fetch(CLAUDE_MESSAGES_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": CLAUDE_API_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: opts?.model ?? process.env["ANTHROPIC_MODEL"] ?? DEFAULT_CLAUDE_MODEL,
      max_tokens: opts?.maxTokens ?? 8192,
      ...(systemMessages.length ? { system: systemMessages.join("\n\n") } : {}),
      messages: claudeMessages,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(claudeErrorMessage(res.status, detail));
  }

  const body = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
  return (
    body.content
      ?.filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("\n")
      .trim() ?? ""
  );
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
