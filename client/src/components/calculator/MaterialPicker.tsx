/**
 * Material selector.
 *
 * One dialog for every viewport rather than a desktop dropdown plus a mobile
 * sheet: a searchable combobox inside a 375px cell is miserable, and a
 * full-height searchable list is better on a laptop too when the catalogue is
 * 194 items.
 *
 * Keeps v2's two affordances: case-insensitive substring search with the
 * matched span emphasised, and a (common) tag on "*" materials.
 */
import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useMaterials } from "@/lib/queries";
import { money, qty } from "@shared/money";
import { cn } from "@/lib/utils";
import type { WireMaterial } from "@shared/types";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Emphasises the matched substring, as v2's picker did. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, "ig"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="bg-transparent font-semibold text-primary">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function MaterialPicker({
  value,
  onSelect,
  className,
}: {
  /** Current display name for the row. */
  value: string;
  onSelect: (m: WireMaterial) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data } = useMaterials();

  const results = useMemo(() => {
    const list = data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (m) => m.name.toLowerCase().includes(q) || (m.supplier ?? "").toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left text-sm",
          "transition-colors hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none",
          className,
        )}
      >
        <span className="truncate">{value || "Select material"}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl p-0" showClose={false}>
          <DialogHeader className="mb-0 border-b border-card-border p-4">
            <DialogTitle className="sr-only">Select a material</DialogTitle>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search materials…"
                className="pl-9"
              />
            </div>
          </DialogHeader>

          <ul className="max-h-[60vh] overflow-y-auto">
            {results.length === 0 ? (
              <li className="p-6 text-center text-sm text-muted-foreground">No results</li>
            ) : (
              results.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(m);
                      setOpen(false);
                    }}
                    className="warm-row flex w-full items-center justify-between gap-3 border-b border-card-border px-4 py-2.5 text-left text-sm last:border-b-0"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">
                        <Highlight text={m.name} query={query} />
                        {m.name.includes("*") ? (
                          <span className="badge-blush ml-2">common</span>
                        ) : null}
                      </span>
                      {m.supplier ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {m.supplier}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-xs tabular text-muted-foreground",
                        m.base_qty === 0 && "text-urgent",
                      )}
                    >
                      {money(m.base_cost)} / {qty(m.base_qty)}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="border-t border-card-border px-4 py-2 text-xs text-muted-foreground">
            {results.length} of {data?.length ?? 0} materials
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
