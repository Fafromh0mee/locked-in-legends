type CaptionTrack = {
  baseUrl?: string;
  languageCode?: string;
  name?: { simpleText?: string; runs?: Array<{ text?: string }> };
  kind?: string;
};

type PlayerResponse = {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
    };
  };
  videoDetails?: {
    title?: string;
  };
};

export type YouTubeContext = {
  url: string;
  videoId: string | null;
  title: string | null;
  transcript: string | null;
  unavailableReason: string | null;
};

const MAX_TRANSCRIPT_CHARS = 12_000;

export async function getYouTubeContext(rawUrl: string): Promise<YouTubeContext> {
  const url = rawUrl.trim();
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    return {
      url,
      videoId: null,
      title: null,
      transcript: null,
      unavailableReason: "The YouTube URL was not recognized.",
    };
  }

  try {
    const page = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`, {
      headers: {
        "accept-language": "en-US,en;q=0.9",
        "user-agent": "Mozilla/5.0 StudlyBot/1.0",
      },
    });
    const html = await page.text();
    const player = extractPlayerResponse(html);
    const title = player?.videoDetails?.title ?? (await fetchOembedTitle(url));
    const track = pickCaptionTrack(player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []);
    const transcript = track?.baseUrl ? await fetchCaptionText(track.baseUrl) : null;

    return {
      url,
      videoId,
      title: title ?? null,
      transcript,
      unavailableReason: transcript ? null : "No public transcript was available for this video.",
    };
  } catch {
    return {
      url,
      videoId,
      title: await fetchOembedTitle(url),
      transcript: null,
      unavailableReason: "The YouTube transcript could not be fetched.",
    };
  }
}

function extractYouTubeVideoId(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    if (host.endsWith("youtube.com")) {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(parts[0] ?? "")) return parts[1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

function extractPlayerResponse(html: string): PlayerResponse | null {
  const marker = "ytInitialPlayerResponse";
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;

  const start = html.indexOf("{", markerIndex);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < html.length; i += 1) {
    const char = html[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1)) as PlayerResponse;
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function pickCaptionTrack(tracks: CaptionTrack[]) {
  if (tracks.length === 0) return null;
  return (
    tracks.find((track) => track.languageCode?.toLowerCase().startsWith("en") && track.kind !== "asr") ??
    tracks.find((track) => track.languageCode?.toLowerCase().startsWith("en")) ??
    tracks.find((track) => track.kind !== "asr") ??
    tracks[0] ??
    null
  );
}

async function fetchCaptionText(baseUrl: string) {
  const url = baseUrl.includes("fmt=") ? baseUrl : `${baseUrl}&fmt=json3`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const raw = await res.text();
  const fromJson = parseJsonCaptions(raw);
  const text = fromJson ?? parseXmlCaptions(raw);
  const cleaned = cleanTranscript(text ?? "");
  return cleaned ? cleaned.slice(0, MAX_TRANSCRIPT_CHARS) : null;
}

function parseJsonCaptions(raw: string) {
  try {
    const body = JSON.parse(raw) as {
      events?: Array<{ segs?: Array<{ utf8?: string }> }>;
    };
    return body.events
      ?.flatMap((event) => event.segs ?? [])
      .map((seg) => seg.utf8 ?? "")
      .join(" ");
  } catch {
    return null;
  }
}

function parseXmlCaptions(raw: string) {
  const parts: string[] = [];
  const matches = raw.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g);
  for (const match of matches) parts.push(decodeHtml(match[1] ?? ""));
  return parts.join(" ");
}

function cleanTranscript(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

async function fetchOembedTitle(url: string) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { title?: string };
    return body.title ?? null;
  } catch {
    return null;
  }
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}
