import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { StudlyLogo } from "@/components/brand/StudlyLogo";
import { Ambience } from "@/components/motion/Ambience";
import { Floaty, Reveal } from "@/components/motion/Reveal";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-14">
      <Ambience />
      <Reveal className="relative w-full max-w-md">
        <div className="glass-card glow-ring p-8 backdrop-blur-xl sm:p-10">
          <Floaty amount={5} className="mb-7 flex items-center justify-center">
            <Link to="/" aria-label="Studly home">
              <StudlyLogo className="h-16" />
            </Link>
          </Floaty>


          <h1 className="font-display text-2xl font-semibold text-foreground">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>

          <div className="mt-8">{children}</div>

          {footer ? <div className="mt-7 text-center text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </Reveal>
    </main>
  );
}
