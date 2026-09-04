/**
 * App chrome: sidebar, mobile top bar, page header, and a single scroll root.
 *
 * v2 nested two `overflow: auto` containers (AppShell + PageContainer), which
 * produced the double-scrollbar behaviour. There is exactly one here.
 */
import { Outlet } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { Menu, Moon, Sun, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { DesktopSidebar, MobileSidebar, useSidebarPinned } from "./Sidebar";
import { HealthPill } from "./HealthPill";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${theme}. Switch to ${next}.`}
      title={`Theme: ${theme}`}
    >
      <Icon className="size-4" />
    </Button>
  );
}

/** Per-page header bar. Pages supply their own title and actions. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-serif text-2xl leading-tight sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function AppShell() {
  const { pinned, toggle } = useSidebarPinned();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <DesktopSidebar pinned={pinned} onTogglePin={toggle} />
      <MobileSidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 lg:hidden">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="text-sidebar-foreground"
        >
          <Menu className="size-5" />
        </button>
        <img src="/hmbb-mini-logo.png" alt="" className="size-7 rounded" />
        <span className="font-serif text-base font-medium text-sidebar-foreground">
          Cost Calculator
        </span>
        <div className="ml-auto flex items-center gap-1">
          <HealthPill compact />
        </div>
      </header>

      {/* Content. Margin shifts only when the rail is PINNED -- a hover
          expansion floats above instead of pushing the page around. */}
      <div
        className={cn(
          "mt-14 transition-[margin] duration-200 lg:mt-0",
          pinned ? "lg:ml-64" : "lg:ml-14",
        )}
      >
        {/* Desktop top bar */}
        <header className="sticky top-0 z-20 hidden h-14 items-center gap-3 border-b border-border bg-background/95 px-6 backdrop-blur lg:flex">
          <HealthPill />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
