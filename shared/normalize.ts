/**
 * Shared normalisation helpers. Ported verbatim from v2 so behaviour is
 * identical -- these decide identity, so a subtle change here would silently
 * merge or duplicate the operator's products.
 */

/** Verbatim from ProductsProvider.jsx normalizeName(). Backs the UNIQUE index. */
export function normalizeName(name: unknown): string {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * v2's "common material" convention: a "*" anywhere in the name. The operator
 * is trained on this, so it stays the user-facing source of truth; we merely
 * denormalise it into an indexed column on write.
 */
export function isCommonName(name: unknown): boolean {
  return String(name ?? "").includes("*");
}
