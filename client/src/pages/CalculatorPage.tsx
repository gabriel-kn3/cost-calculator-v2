/**
 * The Calculator -- the core of the tool.
 *
 * Every number here comes from shared/costMath.ts, which is a verified 1:1
 * port of v2's logic (see tests/characterization). Nothing on this screen
 * recomputes anything itself.
 *
 * Behaviour held at parity with v2: "Add Common (*)" skips materials already
 * present, a new row defaults used_qty to 1, Clear Draft detaches from the
 * saved product, and saving upserts by name so re-saving updates rather than
 * duplicating. New: the draft survives a refresh.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Save, Sparkles, Upload, Download, Eraser, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LineItems } from "@/components/calculator/LineItems";
import { LaborCard, TotalsCard, ProfitsCard } from "@/components/calculator/Cards";
import { RichNotesEditor, PlainNotesEditor } from "@/components/notes/NotesEditor";
import { useIsWideScreen } from "@/hooks/useMediaQuery";
import { draft, useDraft, buildSavePayload, type DraftState } from "@/lib/draft";
import { useMaterials, useSettings, useSaveProduct, useProducts } from "@/lib/queries";
import { normalizeName } from "@shared/normalize";
import { totalCost } from "@shared/costMath";
import { money, toNumber } from "@shared/money";

export default function CalculatorPage() {
  const state = useDraft();
  const materials = useMaterials();
  const settings = useSettings();
  const saveProduct = useSaveProduct();

  // Rich notes need BOTH the room and the opt-in; a phone always gets plain.
  const wide = useIsWideScreen();
  const useRichNotes = wide && (settings.data?.settings.richNotesEnabled ?? true);

  const [clearOpen, setClearOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [pendingOverwrite, setPendingOverwrite] = useState<string | null>(null);
  const saving = useRef(false);
  const products = useProducts();
  const fileInput = useRef<HTMLInputElement>(null);

  // Server settings seed a pristine draft only; they never overwrite work
  // in progress or a loaded product's own snapshot.
  useEffect(() => {
    const s = settings.data;
    if (!s) return;
    draft.applyDefaults({
      laborRate: s.settings.laborRate,
      taxPercent: s.settings.taxPercent,
      profitPercent: s.settings.profitPercent,
      fees: s.fees
        .filter((f) => f.enabled)
        .map((f) => ({ serviceName: f.label, percentage: f.percentage })),
    });
  }, [settings.data]);

  const rows = state.rowOrder.map((id) => state.rowsById[id]).filter(Boolean) as DraftState["rowsById"][string][];

  const totals = useMemo(
    () =>
      totalCost(
        {
          rows,
          workedHours: state.workedHours,
          laborRate: state.laborRate,
          additionalFees: state.fees,
        },
        { taxPercent: state.taxPercent, taxBasis: "subtotal", salePrice: state.salePrice },
      ),
    [rows, state.workedHours, state.laborRate, state.fees, state.taxPercent, state.salePrice],
  );

  const addCommon = () => {
    const commons = (materials.data ?? []).filter((m) => m.name.includes("*"));
    const added = draft.addCommon(
      commons.map((m) => ({
        id: String(m.id),
        name: m.name,
        base_cost: m.base_cost,
        base_qty: m.base_qty,
        supplier: m.supplier,
      })),
    );
    toast.success(
      added === 0 ? "All common materials are already in this draft." : `Added ${added} common materials`,
    );
  };

  // Bound to a saved product and identical to what was stored: nothing to do.
  const unchanged = draft.isUnchangedSinceSave();

  const openSave = () => {
    if (unchanged) {
      toast.info("No changes to save — this product is already up to date.");
      return;
    }
    setSaveName(state.name);
    setSaveOpen(true);
  };

  /**
   * Deduplication. Saving a NEW draft under the name of an existing product
   * updates that product rather than creating a second one (v2's rule, now
   * enforced by a UNIQUE index). v2 did that silently, which could quietly
   * overwrite a product's line items -- so it is now confirmed first.
   */
  const nameClash = (name: string) => {
    if (state.activeProductId) return null;
    const norm = normalizeName(name);
    return (products.data ?? []).find((p) => normalizeName(p.name) === norm) ?? null;
  };

  const doSave = (confirmedOverwrite = false) => {
    // Double-submit lock. A ref, not saveProduct.isPending: Enter, Enter and a
    // click can all fire before React re-renders, and each would still read
    // the stale isPending=false captured at render time.
    if (saving.current) return;
    const name = saveName.trim();
    if (!name) return;

    const clash = nameClash(name);
    if (clash && !confirmedOverwrite) {
      setPendingOverwrite(clash.name);
      return;
    }

    saving.current = true;
    saveProduct.mutate(
      {
        ...buildSavePayload(state),
        ...(state.activeProductId ? { id: state.activeProductId } : {}),
        name,
      },
      {
        onSuccess: (p) => {
          draft.markSaved(String(p.id), p.name);
          setSaveOpen(false);
          setPendingOverwrite(null);
          toast.success(`Saved ${p.name}`);
        },
        onError: (err: unknown) =>
          toast.error(err instanceof Error ? err.message : "Could not save product"),
        onSettled: () => {
          saving.current = false;
        },
      },
    );
  };


  const exportDraft = () => {
    const payload = {
      kind: "calculation",
      version: 1,
      exported_at: new Date().toISOString(),
      data: state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `costcalc_draft_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Draft exported");
  };

  const importDraft = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { kind?: string; data?: Partial<DraftState> };
      if (parsed.kind !== "calculation" || !parsed.data) {
        toast.error("That file is not a calculator draft.");
        return;
      }
      // An imported draft is a NEW draft unless it carries activeProductId,
      // matching v2.
      draft.replace(parsed.data);
      toast.success("Draft imported");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that file");
    }
  };

  /** One definition, rendered at the top and the bottom, so they cannot drift. */
  const toolbar = (
    <>
      <Button variant="outline" onClick={addCommon}>
        <Sparkles className="size-4" /> Add Common (*)
      </Button>
      <Button
        onClick={openSave}
        variant={unchanged ? "outline" : "default"}
        title={unchanged ? "No changes since the last save" : undefined}
      >
        {unchanged ? <Check className="size-4" /> : <Save className="size-4" />}
        {unchanged ? "Saved" : "Save"}
      </Button>
      <Button variant="outline" onClick={() => fileInput.current?.click()}>
        <Upload className="size-4" /> Import Draft
      </Button>
      <Button variant="outline" onClick={exportDraft}>
        <Download className="size-4" /> Export Draft
      </Button>
      <Button variant="outline" onClick={() => setClearOpen(true)}>
        <Eraser className="size-4" /> Clear Draft
      </Button>
    </>
  );

  return (
    <>
      <PageHeader
        title="Calculator"
        subtitle={
          state.activeProductId
            ? "Editing a saved product — saving updates it."
            : "Build a draft product and compute totals"
        }
        actions={toolbar}
      />

      {/* Shared by both toolbars. */}
      <input
        ref={fileInput}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importDraft(f);
          e.target.value = "";
        }}
      />

      <Card className="mb-6 overflow-hidden">
        <div className="border-b border-card-border p-4">
          <h3 className="text-sm font-semibold">Product Draft</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Name, notes, and line-items</p>

          <div className="mt-4 flex flex-col gap-3">
            <div className="flex max-w-md flex-col gap-1.5">
              <Label htmlFor="p-name">Product Name</Label>
              <Input
                id="p-name"
                value={state.name}
                onChange={(e) => draft.setField("name", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-notes">Notes</Label>
              {useRichNotes ? (
                <RichNotesEditor
                  value={state.notes}
                  onChange={(md) => draft.setField("notes", md)}
                  placeholder="Notes"
                />
              ) : (
                <PlainNotesEditor
                  value={state.notes}
                  onChange={(v) => draft.setField("notes", v)}
                  rows={3}
                />
              )}
              <p className="text-xs text-muted-foreground">
                {useRichNotes
                  ? "Saved as Markdown, so the same note stays editable on a phone."
                  : "Markdown — the wide-screen editor writes the same format."}
              </p>
            </div>
          </div>
        </div>

        <LineItems rows={rows} />

        {/* The full toolbar again, so a long list never means scrolling back
            up to save. */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-card-border p-4">
          {toolbar}
        </div>
      </Card>

      {/* Extra bottom padding on mobile so the sticky total never covers the
          last card. */}
      <div className="grid gap-4 pb-20 lg:grid-cols-3 lg:pb-0">
        <LaborCard state={state} />
        <TotalsCard totals={totals} taxPercent={state.taxPercent} />
        <ProfitsCard state={state} totals={totals} />
      </div>

      {/* Mobile: the number you are steering toward stays on screen while you
          edit quantities. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-card-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between">
          <span className="section-label">Total</span>
          <span className="text-lg font-semibold tabular">{money(totals.total)}</span>
        </div>
      </div>

      <ConfirmDialog
        open={pendingOverwrite !== null}
        onOpenChange={(o) => !o && setPendingOverwrite(null)}
        title={`"${pendingOverwrite}" already exists`}
        description="Saving will update that product with this draft rather than create a duplicate. Its current line items will be replaced. To keep both, cancel and choose a different name."
        confirmLabel="Update existing product"
        onConfirm={() => doSave(true)}
      />

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear this draft?"
        description="Removes every line item and detaches it from any saved product."
        confirmLabel="Clear"
        onConfirm={() => {
          draft.clear();
          setClearOpen(false);
          toast.success("Draft cleared");
        }}
      />

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{state.activeProductId ? "Update product" : "Save product"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="save-name">Product Name</Label>
            <Input
              id="save-name"
              autoFocus
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSave()}
              disabled={saveProduct.isPending}
              placeholder="e.g. Roof Panel v1"
            />
            <p className="text-xs text-muted-foreground">
              Saving stores this cost of {money(totals.total)} with today&apos;s tax and fees.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => doSave()} disabled={!saveName.trim() || saveProduct.isPending}>
              {saveProduct.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
