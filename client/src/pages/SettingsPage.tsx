/**
 * Settings.
 *
 * These values used to be hardcoded in a React reducer (v2's
 * CalculationProvider initialState); this screen is where they finally live.
 *
 * Two deliberate rules:
 *   - Explicit Save per section, never autosave. Silently changing a tax rate
 *     would reprice the draft under the operator's cursor.
 *   - Saving settings changes NOTHING about already-saved products: each one
 *     carries its own tax/fee snapshot. The UI says so, because that is not
 *     obvious and it is the thing most likely to worry someone.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Coins,
  Percent,
  Palette,
  Database,
  Plus,
  Trash2,
  Download,
  Upload,
  Save as SaveIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, NumericInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { useSettings, keys } from "@/lib/queries";
import { api } from "@/lib/api";
import { useTheme } from "@/components/theme-provider";
import { money, round2, toNumber } from "@shared/money";
import { salePriceFromProfitPercent } from "@shared/costMath";
import { cn } from "@/lib/utils";
import type { FeeRecord, Settings } from "@shared/types";

const TABS = [
  { id: "pricing", label: "Pricing", icon: Coins },
  { id: "fees", label: "Fees", icon: Percent },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "data", label: "Data", icon: Database },
] as const;

type TabId = (typeof TABS)[number]["id"];

function Section({
  title,
  description,
  children,
  dirty,
  onSave,
  saving,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  dirty?: boolean;
  onSave?: () => void;
  saving?: boolean;
}) {
  return (
    <Card className="mb-4">
      <div className="border-b border-card-border p-5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="p-5">{children}</div>
      {onSave ? (
        <div className="flex items-center justify-between gap-3 border-t border-card-border p-4">
          <span className="text-xs text-muted-foreground">
            {dirty ? "Unsaved changes" : "Saved"}
          </span>
          <Button onClick={onSave} disabled={!dirty || saving}>
            <SaveIcon className="size-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ pricing */

function PricingSection({ settings }: { settings: Settings }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    laborRate: String(settings.laborRate),
    taxPercent: String(settings.taxPercent),
    taxBasis: settings.taxBasis,
    profitPercent: String(settings.profitPercent),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      laborRate: String(settings.laborRate),
      taxPercent: String(settings.taxPercent),
      taxBasis: settings.taxBasis,
      profitPercent: String(settings.profitPercent),
    });
  }, [settings]);

  const dirty =
    form.laborRate !== String(settings.laborRate) ||
    form.taxPercent !== String(settings.taxPercent) ||
    form.taxBasis !== settings.taxBasis ||
    form.profitPercent !== String(settings.profitPercent);

  const save = async () => {
    setSaving(true);
    try {
      await api.settings.update({
        laborRate: toNumber(form.laborRate),
        taxPercent: toNumber(form.taxPercent),
        taxBasis: form.taxBasis,
        profitPercent: toNumber(form.profitPercent),
      });
      await qc.invalidateQueries({ queryKey: keys.settings });
      toast.success("Pricing defaults saved. Saved products keep their own values.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  // The worked example. Markup-vs-margin is the documented footgun, so it is
  // spelled out with real numbers rather than left to the label.
  const pct = toNumber(form.profitPercent);
  const example = 50;
  const price = round2(salePriceFromProfitPercent(example, pct));
  const kept = round2(price - example);
  const marginPct = price > 0 ? round2((kept / price) * 100) : 0;

  return (
    <Section
      title="Pricing defaults"
      description="Applied to new calculations. Saved products keep the values they were priced with."
      dirty={dirty}
      onSave={save}
      saving={saving}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="s-labor">Labor rate (per hour)</Label>
          <NumericInput
            id="s-labor"
            value={form.laborRate}
            onChange={(e) => setForm({ ...form, laborRate: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="s-tax">Tax rate (%)</Label>
          <NumericInput
            id="s-tax"
            value={form.taxPercent}
            onChange={(e) => setForm({ ...form, taxPercent: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>Tax basis</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            {(
              [
                ["subtotal", "On subtotal (materials + labour)"],
                ["sale_price", "On sale price"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={cn(
                  "flex flex-1 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                  form.taxBasis === value ? "border-primary bg-primary/10" : "border-border",
                )}
              >
                <input
                  type="radio"
                  name="taxBasis"
                  className="accent-primary"
                  checked={form.taxBasis === value}
                  onChange={() => setForm({ ...form, taxBasis: value })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="s-profit">Default profit markup (%)</Label>
          <NumericInput
            id="s-profit"
            value={form.profitPercent}
            onChange={(e) => setForm({ ...form, profitPercent: e.target.value })}
          />
        </div>
      </div>

      <p className="mt-4 rounded-md border border-blush-border bg-blush-bg px-3 py-2 text-xs text-blush-fg">
        At {pct}%, a {money(example)} product prices at {money(price)} — you keep {money(kept)},
        which is {marginPct}% of the sale. This is <strong>markup on cost</strong>, not margin.
      </p>
    </Section>
  );
}

/* --------------------------------------------------------------------- fees */

function FeesSection({ fees }: { fees: FeeRecord[] }) {
  const qc = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<FeeRecord | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newPct, setNewPct] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: keys.settings });

  const saveFee = async (fee: Partial<FeeRecord> & { label: string }) => {
    try {
      await api.settings.saveFee(fee);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save fee");
    }
  };

  const addFee = async () => {
    if (!newLabel.trim()) return;
    await saveFee({ label: newLabel.trim(), percentage: toNumber(newPct) });
    setNewLabel("");
    setNewPct("");
    toast.success("Fee added");
  };

  const enabledTotal = fees.filter((f) => f.enabled).reduce((a, f) => a + f.percentage, 0);

  return (
    <Section
      title="Platform fees"
      description="Percentage fees applied to the subtotal of every new calculation."
    >
      <ul className="flex flex-col gap-2">
        {fees.map((fee) => (
          <li key={fee.id} className="flex items-center gap-2 rounded-md border border-border p-2">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={fee.enabled}
              aria-label={`${fee.label} enabled`}
              onChange={(e) => void saveFee({ ...fee, enabled: e.target.checked })}
            />
            <Input
              value={fee.label}
              aria-label="Fee name"
              className="flex-1"
              onChange={(e) => void saveFee({ ...fee, label: e.target.value })}
            />
            <NumericInput
              value={String(fee.percentage)}
              aria-label={`${fee.label} percentage`}
              className="w-24"
              onChange={(e) => void saveFee({ ...fee, percentage: toNumber(e.target.value) })}
            />
            <span className="text-xs text-muted-foreground">%</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${fee.label}`}
              className="text-destructive hover:text-destructive"
              onClick={() => setPendingDelete(fee)}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-end gap-2 border-t border-card-border pt-4">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="new-fee">Add a fee</Label>
          <Input
            id="new-fee"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. Etsy"
          />
        </div>
        <div className="flex w-24 flex-col gap-1.5">
          <Label htmlFor="new-pct">%</Label>
          <NumericInput
            id="new-pct"
            value={newPct}
            onChange={(e) => setNewPct(e.target.value)}
            placeholder="6.5"
          />
        </div>
        <Button onClick={addFee} disabled={!newLabel.trim()}>
          <Plus className="size-4" /> Add
        </Button>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        On a {money(100)} subtotal these cost you {money(100 * (enabledTotal / 100))} in total.
        Deleting a fee does not change any saved product — each one keeps the fees it was priced
        with.
      </p>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Delete the ${pendingDelete?.label} fee?`}
        description="New calculations stop including it. Saved products keep their own snapshot."
        onConfirm={async () => {
          const fee = pendingDelete;
          setPendingDelete(null);
          if (!fee) return;
          await api.settings.deleteFee(fee.id);
          await refresh();
          toast.success(`Deleted ${fee.label}`);
        }}
      />
    </Section>
  );
}

/* --------------------------------------------------------------- appearance */

function AppearanceSection({ settings }: { settings: Settings }) {
  const qc = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [richNotes, setRichNotes] = useState(settings.richNotesEnabled);
  const [saving, setSaving] = useState(false);

  useEffect(() => setRichNotes(settings.richNotesEnabled), [settings.richNotesEnabled]);

  const dirty = richNotes !== settings.richNotesEnabled;

  const save = async () => {
    setSaving(true);
    try {
      await api.settings.update({ richNotesEnabled: richNotes });
      await qc.invalidateQueries({ queryKey: keys.settings });
      toast.success("Appearance saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Appearance" dirty={dirty} onSave={save} saving={saving}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label>Theme</Label>
          <div className="flex gap-2">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={cn(
                  "flex-1 rounded-md border px-3 py-2 text-sm capitalize transition-colors",
                  theme === t ? "border-primary bg-primary/10" : "border-border hover:bg-accent",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Applies to this device immediately; it is not shared between devices.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Product notes</Label>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={richNotes}
              onChange={(e) => setRichNotes(e.target.checked)}
            />
            <span>
              <span className="block text-sm">Rich text editor on wide screens</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Bullets, numbered steps and links. Phones always get the plain editor — both write
                the same Markdown, so a note edited on either never loses its formatting.
              </span>
            </span>
          </label>
        </div>
      </div>
    </Section>
  );
}

/* --------------------------------------------------------------------- data */

function DataSection() {
  const [restoring, setRestoring] = useState(false);
  const qc = useQueryClient();

  const backup = async () => {
    try {
      const bundle = await api.backup.dump();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `costcalc_backup_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create backup");
    }
  };

  const restore = async (file: File) => {
    setRestoring(true);
    try {
      const bundle = JSON.parse(await file.text()) as { kind?: string };
      if (bundle.kind !== "backup") {
        toast.error("That file is not a backup bundle.");
        return;
      }
      const res = await api.backup.restore(bundle);
      await qc.invalidateQueries();
      toast.success(`Restored ${res.materials} materials and ${res.products} products`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not restore");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Section
      title="Backup & restore"
      description="A backup contains everything: materials, products, every line item, settings and fees."
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={backup}>
          <Download className="size-4" /> Back up now
        </Button>
        <label className="inline-flex">
          <input
            type="file"
            accept="application/json"
            className="hidden"
            disabled={restoring}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void restore(f);
              e.target.value = "";
            }}
          />
          <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-accent">
            <Upload className="size-4" /> {restoring ? "Restoring…" : "Restore from file"}
          </span>
        </label>
      </div>
      <p className="mt-4 rounded-md border border-warning-border bg-warning-muted px-3 py-2 text-xs">
        Restoring <strong>replaces</strong> everything currently in the database. Take a backup
        first. The database file itself lives at <code className="font-mono">data/app.db</code> and
        can simply be copied.
      </p>
    </Section>
  );
}

/* --------------------------------------------------------------------- page */

export default function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const { data, isLoading } = useSettings();

  const tab = (params.get("tab") as TabId | null) ?? "pricing";
  const setTab = (t: TabId) => {
    params.set("tab", t);
    setParams(params, { replace: true });
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Defaults for new calculations, and your data." />

      <div className="mb-5 flex flex-wrap gap-1.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              tab === id
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          {tab === "pricing" ? <PricingSection settings={data.settings} /> : null}
          {tab === "fees" ? <FeesSection fees={data.fees} /> : null}
          {tab === "appearance" ? <AppearanceSection settings={data.settings} /> : null}
          {tab === "data" ? <DataSection /> : null}
        </>
      )}
    </>
  );
}
