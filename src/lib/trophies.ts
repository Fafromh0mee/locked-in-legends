import bronze from "@/assets/trophies/bronze-book.png.asset.json";
import diamond from "@/assets/trophies/diamond.png.asset.json";
import gold from "@/assets/trophies/gold-cap.png.asset.json";
import rose from "@/assets/trophies/pink-star.png.asset.json";
import amethyst from "@/assets/trophies/purple-cup.png.asset.json";
import silver from "@/assets/trophies/silver-book.png.asset.json";

export type LeagueTier = 1 | 2 | 3 | 4 | 5 | 6;

export const TROPHIES: Record<number, { name: string; url: string; glow: string }> = {
  1: { name: "Bronze", url: bronze.url, glow: "oklch(0.72 0.08 60)" },
  2: { name: "Silver", url: silver.url, glow: "oklch(0.85 0.01 280)" },
  3: { name: "Gold", url: gold.url, glow: "oklch(0.82 0.14 85)" },
  4: { name: "Rose", url: rose.url, glow: "oklch(0.78 0.11 12)" },
  5: { name: "Amethyst", url: amethyst.url, glow: "oklch(0.7 0.13 300)" },
  6: { name: "Diamond", url: diamond.url, glow: "oklch(0.8 0.09 230)" },
};

export const LEAGUE_TIERS: LeagueTier[] = [1, 2, 3, 4, 5, 6];

export function trophyFor(tier: number | null | undefined) {
  return TROPHIES[tier ?? 1] ?? TROPHIES[1]!;
}
