import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs transition-colors",
        "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Money/quantity field. type="text" with inputMode="decimal" on purpose:
 * type="number" rejects "1,000", which the frozen toNumber() is built to
 * accept, and it adds spinners nobody wants on a phone.
 */
export function NumericInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={cn("tabular text-right", className)}
      {...props}
    />
  );
}
