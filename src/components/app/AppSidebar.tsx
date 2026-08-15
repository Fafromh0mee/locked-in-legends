import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronsLeft,
  ChevronsRight,
  Clapperboard,
  Flame,
  LayoutGrid,
  Layers,
  ListChecks,
  LogOut,
  Settings,
  Sparkles,
  Trophy,
  User,
  Users,
} from "lucide-react";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { StudlyLogo } from "@/components/brand/StudlyLogo";
import { cn } from "@/lib/utils";

type NavItem = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  to?: "/home" | "/profile" | "/episodes" | "/leagues" | "/create" | "/cast" | "/chat" | "/flashcards";
  soon?: boolean;
};

const NAV: NavItem[] = [
  { key: "home", label: "Home", icon: LayoutGrid, to: "/home" },
  { key: "episodes", label: "Episodes", icon: ListChecks, to: "/episodes" },
  { key: "flashcards", label: "Flashcards", icon: Layers, to: "/flashcards" },
  { key: "create", label: "Create", icon: Clapperboard, to: "/create" },
  { key: "cast", label: "Cast", icon: Users, to: "/cast" },
  { key: "leagues", label: "Leagues", icon: Trophy, to: "/leagues" },
  { key: "profile", label: "Profile", icon: User, to: "/profile" },
];

const VISIBILITY_KEY = "studly.sidebar.visibility";
const COLLAPSED_KEY = "studly.sidebar.collapsed";

export function AppSidebar() {
  const { profile, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
    try {
      const raw = localStorage.getItem(VISIBILITY_KEY);
      if (raw) setHidden(JSON.parse(raw) as string[]);
    } catch {
      setHidden([]);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(VISIBILITY_KEY, JSON.stringify(hidden));
  }, [hidden, hydrated]);

  const items = useMemo(
    () => NAV.filter((item) => item.key !== "create" && !hidden.includes(item.key)),
    [hidden],
  );

  const initials = (profile?.display_name || profile?.username || "S").slice(0, 2).toUpperCase();

  function toggleVisibility(key: string, visible: boolean) {
    setHidden((prev) => (visible ? prev.filter((k) => k !== key) : [...new Set([...prev, key])]));
  }

  return (
    <TooltipProvider delayDuration={120}>
      <aside
        className={cn(
          "sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl transition-[width] duration-300 ease-out md:flex",
          collapsed ? "w-[76px]" : "w-64",
        )}
      >
        <div className={cn("flex items-center gap-3 px-4 pt-5", collapsed && "justify-center px-0")}>
          <StudlyLogo className={collapsed ? "h-9" : "h-11"} />
        </div>


        <div className={cn("space-y-2 px-3 pt-5", collapsed && "px-2")}>
          {!hidden.includes("create") &&
            (collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    className="press cta-studio cta-sheen h-11 w-full justify-center rounded-2xl px-0 hover:brightness-110"
                  >
                    <Link to="/create">
                      <Clapperboard className="relative z-[2] size-[18px] shrink-0" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Create a series</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                asChild
                className="press cta-studio cta-sheen h-14 w-full justify-start gap-3 rounded-2xl px-3.5 text-left hover:brightness-110"
              >
                <Link to="/create">
                  <span className="relative z-[2] grid size-9 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25">
                    <Clapperboard className="size-[18px]" />
                  </span>
                  <span className="relative z-[2] min-w-0 flex-1">
                    <span className="block truncate font-display text-sm font-bold leading-tight">
                      Create a series
                    </span>
                    <span className="block truncate text-[11px] font-medium text-white/75">
                      Turn any topic into episodes
                    </span>
                  </span>
                  <ArrowRight className="relative z-[2] size-4 shrink-0 opacity-80" />
                </Link>
              </Button>
            ))}

          <Button
            asChild
            variant="ghost"
            className={cn(
              "press h-11 w-full justify-center gap-2 rounded-2xl border border-primary/25 bg-primary/10 text-sm font-semibold text-primary hover:bg-primary/20 hover:text-primary",
              collapsed && "px-0",
            )}
          >
            <Link to="/chat" search={{ q: undefined, ctx: undefined }}>
              <Sparkles className="size-4 shrink-0" />
              {!collapsed && "Talk to Susu"}
            </Link>
          </Button>
        </div>


        <nav className="mt-6 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {items.map((item) => {
            const active = item.to ? pathname.startsWith(item.to) : false;
            const content = (
              <span
                className={cn(
                  "press flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-glow-sm"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                <item.icon className="size-[18px] shrink-0" />
                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                {!collapsed && item.soon && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    soon
                  </span>
                )}
              </span>
            );

            const node = item.to ? (
              <Link key={item.key} to={item.to} className="block">
                {content}
              </Link>
            ) : (
              <button
                key={item.key}
                type="button"
                className="block w-full text-left"
                onClick={() => toast(`${item.label} unlocks in an upcoming phase.`)}
              >
                {content}
              </button>
            );

            return collapsed ? (
              <Tooltip key={item.key}>
                <TooltipTrigger asChild>{node}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ) : (
              node
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-sidebar-border px-3 py-4">
          <div className={cn("flex items-center gap-2", collapsed && "flex-col")}>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="press rounded-xl" aria-label="Sidebar settings">
                  <Settings className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="right" align="end" className="w-60 rounded-2xl">
                <p className="font-display text-sm font-semibold">Visible tabs</p>
                <p className="mt-1 text-xs text-muted-foreground">Choose what shows up in your sidebar.</p>
                <div className="mt-4 space-y-3">
                  {NAV.map((item) => (
                    <label key={item.key} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <item.icon className="size-4" />
                        {item.label}
                      </span>
                      <Switch
                        checked={!hidden.includes(item.key)}
                        onCheckedChange={(v) => toggleVisibility(item.key, v)}
                      />
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="icon"
              className="press rounded-xl"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed((c) => !c)}
            >
              {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="press rounded-xl text-muted-foreground hover:text-destructive"
              aria-label="Log out"
              onClick={() => void signOut()}
            >
              <LogOut className="size-4" />
            </Button>
          </div>

          <Link
            to="/profile"
            className={cn(
              "press flex items-center gap-3 rounded-2xl border border-sidebar-border bg-surface/70 p-2.5",
              collapsed && "justify-center border-0 bg-transparent p-0",
            )}
          >
            <Avatar className="size-9 ring-1 ring-primary/30">
              <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {profile?.display_name || profile?.username || "Student"}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Flame className="size-3 text-gold" />
                  {profile?.xp ?? 0} XP
                </span>
              </span>
            )}
          </Link>
        </div>
      </aside>
    </TooltipProvider>
  );
}
