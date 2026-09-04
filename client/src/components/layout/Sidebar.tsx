/**
 * Navigation.
 *
 * Desktop: a 56px icon rail that expands to 256px on hover and can be pinned.
 * When expanded but unpinned it FLOATS over the content, so the page never
 * reflows under the cursor -- content margin only changes when you pin it.
 *
 * Below lg: a fixed top bar plus a slide-in drawer, because a rail is useless
 * without a hover state.
 */
import { NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Calculator, LayoutDashboard, Package, Boxes, Settings, Pin, PinOff, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const RAIL_W = 56;
const FULL_W = 256;
const PIN_KEY = "costcalc.sidebarPinned";

export const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/calculator", label: "Calculator", icon: Calculator, end: false },
  { to: "/inventory", label: "Inventory", icon: Boxes, end: false },
  { to: "/products", label: "Products", icon: Package, end: false },
  { to: "/settings", label: "Settings", icon: Settings, end: false },
] as const;

export function useSidebarPinned() {
  const [pinned, setPinned] = useState(() => {
    try {
      return localStorage.getItem(PIN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggle = () => {
    setPinned((p) => {
      try {
        localStorage.setItem(PIN_KEY, p ? "0" : "1");
      } catch {
        /* private mode */
      }
      return !p;
    });
  };
  return { pinned, toggle };
}

function NavItems({ expanded, onNavigate }: { expanded: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5 px-2 py-2">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "sidebar-item flex items-center gap-3 rounded-md px-3 py-2 text-sm",
              "text-sidebar-foreground/80",
              isActive && "sidebar-active font-medium",
            )
          }
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          <motion.span
            animate={{ opacity: expanded ? 1 : 0 }}
            transition={{ duration: 0.15 }}
            aria-hidden={!expanded}
            className={cn("whitespace-nowrap", !expanded && "pointer-events-none")}
          >
            {label}
          </motion.span>
        </NavLink>
      ))}
    </nav>
  );
}

function Brand({ expanded }: { expanded: boolean }) {
  return (
    <div className="flex h-14 items-center gap-3 border-b border-sidebar-border px-4">
      <img src="/hmbb-mini-logo.png" alt="" className="size-7 shrink-0 rounded" />
      <motion.span
        animate={{ opacity: expanded ? 1 : 0 }}
        transition={{ duration: 0.15 }}
        aria-hidden={!expanded}
        className="font-serif text-base font-medium whitespace-nowrap text-sidebar-foreground"
      >
        Cost Calculator
      </motion.span>
    </div>
  );
}

/** Desktop rail. Hidden below lg. */
export function DesktopSidebar({ pinned, onTogglePin }: { pinned: boolean; onTogglePin: () => void }) {
  const [hovered, setHovered] = useState(false);
  const expanded = pinned || hovered;

  return (
    <motion.aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      animate={{ width: expanded ? FULL_W : RAIL_W }}
      transition={{ type: "spring", stiffness: 400, damping: 34 }}
      style={{
        // Only float a shadow when overlaying content, i.e. hover-expanded.
        boxShadow: expanded && !pinned ? "var(--sidebar-overlay-shadow)" : undefined,
      }}
      className="fixed inset-y-0 left-0 z-40 hidden overflow-hidden border-r border-sidebar-border bg-sidebar lg:block"
    >
      {/* Fixed inner width so labels do not reflow mid-animation. */}
      <div className="flex h-full flex-col" style={{ width: FULL_W }}>
        <Brand expanded={expanded} />
        <NavItems expanded={expanded} />
        <div className="mt-auto border-t border-sidebar-border p-2">
          <button
            onClick={onTogglePin}
            className="sidebar-item flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-muted"
            aria-label={pinned ? "Unpin sidebar" : "Pin sidebar open"}
          >
            {pinned ? <PinOff className="size-4 shrink-0" /> : <Pin className="size-4 shrink-0" />}
            <motion.span
              animate={{ opacity: expanded ? 1 : 0 }}
              transition={{ duration: 0.15 }}
              className="whitespace-nowrap"
            >
              {pinned ? "Unpin" : "Pin open"}
            </motion.span>
          </button>
        </div>
      </div>
    </motion.aside>
  );
}

/** Mobile drawer. */
export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation();

  // Close on navigation and on Escape.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-scrim lg:hidden"
          />
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 left-0 z-50 w-72 border-r border-sidebar-border bg-sidebar lg:hidden"
          >
            <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
              <div className="flex items-center gap-3">
                <img src="/hmbb-mini-logo.png" alt="" className="size-7 rounded" />
                <span className="font-serif text-base font-medium text-sidebar-foreground">
                  Cost Calculator
                </span>
              </div>
              <button onClick={onClose} aria-label="Close menu" className="text-sidebar-muted">
                <X className="size-5" />
              </button>
            </div>
            <NavItems expanded onNavigate={onClose} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
