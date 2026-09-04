/**
 * Fails if any colour literal appears outside client/src/index.css.
 * hmbb-admin has ~300 such literals duplicating its own CSS variables, which
 * is why its palette cannot be swapped. This keeps ours swappable.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "client/src";
const RE = /oklch\(|rgba?\(|#[0-9a-fA-F]{3,8}\b|hsla?\(/;
const offenders = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(entry) && !p.endsWith("index.css")) {
      readFileSync(p, "utf8").split("\n").forEach((line, i) => {
        if (RE.test(line)) offenders.push(`${p}:${i + 1}  ${line.trim().slice(0, 100)}`);
      });
    }
  }
}
walk(ROOT);

if (offenders.length) {
  console.error(`Hardcoded colours found (use a token instead):\n${offenders.join("\n")}`);
  process.exit(1);
}
console.log("token check: no hardcoded colours outside index.css");
