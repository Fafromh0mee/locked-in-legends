export type VoiceGender = "neutral" | "feminine" | "masculine";

type VoiceProfile = {
  gender: VoiceGender;
  voiceLabel: "neutral" | "feminine" | "masculine";
};

const VOICE_PROFILES: Record<VoiceGender, VoiceProfile> = {
  neutral: {
    gender: "neutral",
    voiceLabel: "neutral",
  },
  feminine: {
    gender: "feminine",
    voiceLabel: "feminine",
  },
  masculine: {
    gender: "masculine",
    voiceLabel: "masculine",
  },
};

export function normalizeVoiceGender(value: unknown): VoiceGender {
  return value === "feminine" || value === "masculine" ? value : "neutral";
}

export function getVoiceProfile(value: unknown) {
  return VOICE_PROFILES[normalizeVoiceGender(value)];
}

export function narrationFallback(slide: { title: string; bullets?: string[]; takeaway?: string | null }) {
  const bullets = (slide.bullets ?? []).filter(Boolean).join(" ");
  const takeaway = slide.takeaway ? `The takeaway is: ${slide.takeaway}` : "";
  return [slide.title, bullets, takeaway].filter(Boolean).join(". ");
}

export function estimateSpeechDurationSeconds(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(90, Math.max(7, Math.ceil((words / 145) * 60) + 1));
}
