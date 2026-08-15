import { useMemo } from "react";

import { cn } from "@/lib/utils";

/** Drifting aurora blobs + twinkles behind page content. */
export function Ambience({
  className,
  density = 14,
  intensity = "normal",
}: {
  className?: string;
  density?: number;
  intensity?: "soft" | "normal" | "bold";
}) {
  const twinkles = useMemo(
    () =>
      Array.from({ length: density }).map((_, i) => ({
        id: i,
        top: `${(i * 37 + 11) % 96}%`,
        left: `${(i * 61 + 7) % 97}%`,
        size: 2 + ((i * 5) % 3),
        delay: `${(i % 7) * 0.55}s`,
      })),
    [density],
  );

  const opacity = intensity === "soft" ? "opacity-35" : intensity === "bold" ? "opacity-80" : "opacity-55";

  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", opacity, className)}>
      <div
        className="aurora-blob animate-drift"
        style={{
          top: "-14%",
          left: "-8%",
          width: "46rem",
          height: "46rem",
          background: "radial-gradient(circle at 30% 30%, oklch(0.63 0.115 300 / 0.55), transparent 68%)",
        }}
      />
      <div
        className="aurora-blob animate-drift"
        style={{
          bottom: "-22%",
          right: "-12%",
          width: "40rem",
          height: "40rem",
          animationDelay: "-9s",
          background: "radial-gradient(circle at 60% 40%, oklch(0.55 0.13 320 / 0.5), transparent 70%)",
        }}
      />
      <div
        className="aurora-blob animate-drift"
        style={{
          top: "34%",
          left: "42%",
          width: "30rem",
          height: "30rem",
          animationDelay: "-16s",
          background: "radial-gradient(circle at 50% 50%, oklch(0.6 0.1 265 / 0.38), transparent 72%)",
        }}
      />
      {twinkles.map((t) => (
        <span
          key={t.id}
          className="animate-twinkle absolute rounded-full bg-lilac"
          style={{ top: t.top, left: t.left, width: t.size, height: t.size, animationDelay: t.delay }}
        />
      ))}
    </div>
  );
}
