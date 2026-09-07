import { useSyncExternalStore } from "react";

/**
 * Reactive media query.
 *
 * useSyncExternalStore rather than useState + useEffect: this decides which
 * EDITOR renders, not merely what is hidden, so a missed update leaves the
 * wrong component mounted. The store subscription is also correct during
 * concurrent rendering, which the effect version is not.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      // Some environments (device emulation, zoom) resize without emitting a
      // matchMedia change, so listen to resize as well.
      window.addEventListener("resize", onChange);
      return () => {
        mq.removeEventListener("change", onChange);
        window.removeEventListener("resize", onChange);
      };
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tailwind's lg breakpoint -- the line where the rich editor earns its room. */
export const useIsWideScreen = () => useMediaQuery("(min-width: 1024px)");
