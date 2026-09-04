/**
 * Add/edit a material.
 *
 * Copy is carried over verbatim from v2's MaterialFormModal -- labels,
 * placeholders and all. The placeholder "e.g. Aluminum Sheet *" is a leftover
 * from the material-agnostic template and does not match a jewellery
 * catalogue, but changing wording is the operator's call, not ours.
 *
 * Click-outside deliberately does NOT close this, matching v2: it is a form
 * with unsaved input and a stray click should not discard it. Escape works.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, NumericInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveMaterial } from "@/lib/queries";
import type { WireMaterial } from "@shared/types";

const EMPTY = {
  name: "",
  base_cost: "0",
  base_qty: "1",
  supplier: "",
  description: "",
  active: true,
};

type FormState = typeof EMPTY;

function toForm(m: WireMaterial | null): FormState {
  if (!m) return { ...EMPTY };
  return {
    name: m.name ?? "",
    base_cost: String(m.base_cost ?? 0),
    base_qty: String(m.base_qty ?? 1),
    supplier: m.supplier ?? "",
    description: m.description ?? "",
    active: m.active ?? true,
  };
}

export function MaterialDialog({
  open,
  onOpenChange,
  material,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create */
  material: WireMaterial | null;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(material));
  const save = useSaveMaterial();

  useEffect(() => {
    if (open) setForm(toForm(material));
  }, [open, material]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    save.mutate(
      {
        ...(material?.id ? { id: material.id } : {}),
        name: form.name,
        // Sent as strings on purpose: the server coerces with the same
        // toNumber() the calculator uses, so "1,000" keeps working.
        base_cost: form.base_cost as unknown as number,
        base_qty: form.base_qty as unknown as number,
        supplier: form.supplier || null,
        description: form.description || null,
        active: form.active,
      },
      {
        onSuccess: (m) => {
          toast.success(material ? `Updated ${m.name}` : `Added ${m.name}`);
          onOpenChange(false);
        },
        onError: (err: unknown) =>
          toast.error(err instanceof Error ? err.message : "Could not save material"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{material ? "Edit material" : "Add material"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="m-name">Name</Label>
            <Input
              id="m-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Aluminum Sheet *"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Use * in the name for common items.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="m-cost">Base Cost</Label>
              <NumericInput
                id="m-cost"
                value={form.base_cost}
                onChange={(e) => set("base_cost", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="m-qty">Base Qty</Label>
              <NumericInput
                id="m-qty"
                value={form.base_qty}
                onChange={(e) => set("base_qty", e.target.value)}
              />
            </div>
          </div>

          {/* The one live data condition worth warning about inline. */}
          {Number(form.base_qty) === 0 ? (
            <p className="rounded-md border border-urgent-border bg-urgent-muted px-3 py-2 text-xs">
              A base qty of 0 makes this material add <strong>$0.00</strong> to every product that
              uses it.
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="m-supplier">Supplier</Label>
            <Input
              id="m-supplier"
              value={form.supplier}
              onChange={(e) => set("supplier", e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="m-desc">Description</Label>
            <Input
              id="m-desc"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Optional"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={form.active}
              onChange={(e) => set("active", e.target.checked)}
            />
            Active
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
