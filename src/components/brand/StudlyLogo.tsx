import logoAsset from "@/assets/studly-logo.png";
import { cn } from "@/lib/utils";

/** The Studly mark — graffiti wordmark on an open book, recolored for the dark theme. */
export function StudlyLogo({ className }: { className?: string }) {
  return (
    <img
      src={logoAsset}
      alt="Studly"
      className={cn("h-9 w-auto select-none drop-shadow-[0_0_18px_hsl(280_60%_60%/0.35)]", className)}
      draggable={false}
    />
  );
}
