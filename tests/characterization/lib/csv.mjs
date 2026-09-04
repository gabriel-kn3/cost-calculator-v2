// Minimal RFC 4180 CSV parser.
// Written by hand rather than pulled in as a dependency because it is used to
// produce the frozen-math baseline: fewer moving parts between the recovered
// export and the numbers we are pinning.

export function parseCsv(text) {
  // Strip a UTF-8 BOM; Supabase's dashboard export includes one.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = [];
  let field = "";
  let record = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }   // escaped quote
        else inQuotes = false;
      } else field += ch;
      continue;
    }

    if (ch === '"') inQuotes = true;
    else if (ch === ",") { record.push(field); field = ""; }
    else if (ch === "\n") { record.push(field); rows.push(record); record = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field.length || record.length) { record.push(field); rows.push(record); }

  const header = rows.shift();
  return rows
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}
