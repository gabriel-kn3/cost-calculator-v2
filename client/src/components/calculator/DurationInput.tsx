/**
 * Worked time as two fields: hours and minutes.
 *
 * The value in and out is still DECIMAL HOURS (as a string, like every other
 * draft field), so storage, saved products and the frozen labour math are
 * unchanged. The two fields keep their own text while typing -- otherwise
 * typing "90" into minutes would immediately reflow to "1h 30m" under the
 * cursor -- and only resync when the value changes from outside, such as
 * loading a saved product.
 *
 * Importantly, loading a product and NOT touching this field never rewrites
 * its stored hours: nothing is written back until the user edits.
 */
import { useEffect, useState } from "react";
import { NumericInput } from "@/components/ui/input";
import { splitHours, joinHours } from "@shared/duration";
import { toNumber } from "@shared/money";

export function DurationInput({
  id,
  value,
  onChange,
}: {
  id: string;
  /** Decimal hours, e.g. "0.25". */
  value: string;
  onChange: (decimalHours: string) => void;
}) {
  const toFields = (v: string) => {
    const { hours, minutes } = splitHours(v);
    return { h: hours === 0 ? "" : String(hours), m: minutes === 0 ? "" : String(minutes) };
  };

  const [fields, setFields] = useState(() => toFields(value));

  // Resync only when the outside value no longer matches what is typed.
  useEffect(() => {
    if (Math.abs(joinHours(fields.h, fields.m) - toNumber(value, 0)) > 1e-9) {
      setFields(toFields(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const update = (next: { h: string; m: string }) => {
    setFields(next);
    onChange(String(joinHours(next.h, next.m)));
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="relative">
        {/* Decimal keypad on hours, so the old habit of typing 1.5 still works. */}
        <NumericInput
          id={id}
          value={fields.h}
          placeholder="0"
          aria-label="Hours"
          onChange={(e) => update({ ...fields, h: e.target.value })}
          className="pr-10"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          hrs
        </span>
      </label>
      <label className="relative">
        <NumericInput
          inputMode="numeric"
          value={fields.m}
          placeholder="0"
          aria-label="Minutes"
          onChange={(e) => update({ ...fields, m: e.target.value })}
          className="pr-10"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          min
        </span>
      </label>
    </div>
  );
}
