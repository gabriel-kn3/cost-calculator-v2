# Roadmap — next phase

Everything here comes from operator feedback after using the ported app. No code
has been written for any of it yet.

Priorities are as given: **P0** rich-text notes, Shopify lite, product/material
detail + photos · **P0.5** Settings · **P1** Journal · **P2** URL-indexable state.

---

## 1. Rich-text notes on products — P0

**Yes, this is possible, and the interesting part is the storage format, not the editor.**

The trap: if desktop stores rich content and mobile stores plain text in the same
field, editing a note on the wrong device silently destroys formatting. So the
rule is **one field, one format, both editors**.

**Store Markdown.** Not HTML, not editor JSON.

| Option | Why not |
|---|---|
| HTML | Needs sanitising on every read, and is miserable to hand-edit in the mobile textarea |
| Tiptap/ProseMirror JSON | Locks the data to one editor forever; unreadable in a backup or a CSV |
| **Markdown** | The mobile textarea edits it directly and it still reads fine; greppable, diffable, portable, survives replacing the editor |

**Editor:** Tiptap (ProseMirror) + `tiptap-markdown`, StarterKit trimmed to what
she actually uses — bold, italic, bullets, ordered lists, links, headings,
checkboxes. Mature, keyboard-accessible, handles paste-from-Word sanely.

**Behaviour**
- `≥ lg` **and** the Settings toggle on → rich editor
- Below `lg`, or toggle off → plain `<textarea>` on the same Markdown
- Rendered read-only on the product detail page, sanitised on output (defence in
  depth even for her own content — a pasted link can carry a `javascript:` href)

**Schema:** `products.notes` stays `TEXT`. Add `settings.rich_notes_enabled`
(boolean, default true). No migration risk: existing plain notes are already
valid Markdown.

**Effort:** ~1 day. **Do this first** — the Journal reuses the whole editor.

---

## 2. Journal — P1 (design feedback requested)

### What I'd build, and why

**One entity, not two.** She writes entries *and* todos by hand, mixed on the
same page. Modelling those as separate tables fights the habit it is meant to
replace.

```
journal_entries
  id, title (optional), body_markdown,
  entry_date (date, defaults today),
  product_id  (nullable FK, ON DELETE SET NULL)
  material_id (nullable FK, ON DELETE SET NULL)
  created_at, updated_at
```

**Todos live inside entries as Markdown checkboxes** (`- [ ] reorder navy cord`).
The app scans for unchecked boxes and surfaces them — so todos are real and
actionable without a second data model, and an entry can be half prose, half
checklist, exactly as a paper page is.

**Screens**
- `/journal` — reverse-chronological, grouped by day, with an **Open items**
  panel at the top aggregating every unchecked box across all entries. That panel
  is the thing paper cannot do.
- `/journal/:id` — one entry.
- A quick-add affordance available anywhere; when opened from a product or
  material page it pre-links to it.

**The linking is what makes it worth building.** "Re-price these when the cord
goes up" attached to the actual product beats the same sentence in a notebook,
because the product page can then show *"1 open note"*.

### What I'd reject

- **Separate Todos and Notes tables** — two models for one habit, and she'd have
  to decide which one a thought belongs in before writing it.
- **A full task manager** — due dates, priorities, assignees. There is one user.
- **Rich structure imposed up front** — start free-form; add structure only if
  the entries turn out to have a shape.

### Decided

1. **Free entries tied to a day**, grouped by day on the index and easy to search
   back through — not one fixed entry per day.
2. **Checkboxes are ticked inside their entry only.** The Open items panel links
   to the entry rather than writing to it, so there is exactly one write path
   into the Markdown.
3. **Search spans journal, products and materials** — one box over everything.
   Entries, products and materials are expected to behave as one ecosystem:
   cross-links in both directions, and a global search that reaches all three.

That third point raises the scope slightly: it implies a **global search**
surface (⌘K or a header field) rather than a journal-only filter. Worth building
once, over all three entities, rather than three separate search boxes.

**Effort:** ~1.5 days once the Markdown editor exists.

---

## 3. Shopify lite — P0

Three separable pieces, shipped in this order.

### 3a. Export → Shopify-importable CSV (no API, no keys) — ~½ day

From Products (multi-select or all): a CSV with `Handle`, `Title`,
`Variant Price` = sale price, **`Cost per item`** = calculated cost,
`Published` = FALSE so nothing goes live by accident.

The `Cost per item` column is the payoff: Shopify then shows real margin in its
own admin, computed from your material math.

### 3b. Read-only Shopify fetch — ~1.5 days

One custom app in Shopify admin, scopes `read_products`, `read_orders`,
`read_customers`. Token lives in `.env`, **server-side only, never sent to the
browser**.

```
shopify_products   id, handle, title, status, price, inventory, updated_at, raw_json
shopify_orders     id, order_number, created_at, total, customer_id, raw_json
shopify_customers  id, name, email, orders_count, raw_json
shopify_sync_state kind, last_synced_at, cursor
```

A local read-only mirror, refreshed on demand from a Settings button (and
optionally a daily job). Cached because Shopify's REST bucket is ~2 req/s and
this data changes slowly. **Nothing in the app ever writes to Shopify.**

### 3c. Soft link CC product ↔ Shopify product — ~1 day

```
products.shopify_product_id  text nullable
products.shopify_linked_at   text nullable
```

- On the product detail page: **Link to Shopify** → search the cached list → pick.
- Auto-suggest by normalised-name match (reusing `normalizeName`), always
  confirmed by her — never auto-linked.
- Badge on the product card and detail page: **Live** · **Draft** · **Not linked**.
- Unlink is one click; the link is soft, so deleting either side breaks nothing.

### ⚠️ Boundary worth naming

Your storefront project (the `HMBB Web App` Supabase) already owns products,
orders and customers. This must stay a **read-only convenience inside the
calculator** — "which of my priced products are live, and what did they sell
for" — not a second storefront admin. If it starts growing order management,
that is the signal it belongs in the other project instead.

---

## 4. Settings page — P0.5

Mostly already designed; the new items are the toggles the work above needs.

- **Pricing** — labor rate, tax rate + basis, default profit %, with the live
  worked example (markup vs margin is the documented footgun)
- **Fees** — CRUD + reorder; deleting warns that saved products keep their snapshot
- **Appearance** — theme, base font size, currency, locale, timezone,
  **rich-notes toggle**
- **Data** — back up now, restore with a diff preview, download `app.db`,
  **photo storage location and disk usage**
- **Shopify** — connection status, last sync, "Sync now", scopes in use
- **Access** — password, session length, sign out everywhere, tunnel commands

Explicit **Save per section** with a dirty bar. Never autosave: silently changing
a tax rate would reprice the draft under her cursor.

**Effort:** ~1 day. Worth doing early since the rich-notes toggle lives here.

---

## 5. Product detail page + photos — P0

`/products/:id`. Products currently exist only as cards, which is why "product =
pre-filled calc" has nowhere to live.

**Contents:** name · rendered notes · full totals breakdown (the snapshot, not a
recompute) · the bill of materials as a table, each line linking to its material ·
photos · Shopify link status · linked journal entries · **Open in calculator**,
which loads the draft.

### Photos — local storage always

```
photos
  id, entity_type ('product' | 'material'), entity_id,
  filename, mime, width, height, bytes, position, created_at
```

- Files on disk under `data/photos/<entity_type>/<entity_id>/`, **not** in SQLite —
  a database that holds image blobs gets slow and painful to back up.
- Served by the API at `/api/photos/:id` (and `/api/photos/:id/thumb`).
- Thumbnails generated on upload with `sharp`, so grids stay fast.
- `data/` is already gitignored; photos are covered. **The backup bundle must
  include them** — otherwise "restore" silently loses every image. Either zip
  `data/` or add an explicit photo export.
- Replaces the vestigial `products.photos_json`, which has always been `[]`.

**Effort:** photo infrastructure ~1.5 days (shared with materials), detail page
~1 day.

---

## 6. Material detail page + photos — P0

`/inventory/:id`. Shows the material, its photos, and — using the
`product_materials` join already built — **which products use it and what they'd
cost if its price changed**. That answers the question that currently requires
opening products one at a time.

### One suggestion of my own

You mentioned 99% of materials come from Amazon. A **`source_url`** field would
be worth more than the photos: one click to reorder, and the material page
becomes the reorder list. Cheap to add alongside the photo work — say so if you
want it, I have not assumed it.

**Effort:** ~1 day on top of the shared photo infrastructure.

---

## 7. URL-indexable state — P2

Nothing that can be linked to should live only in `useState`.

- Search, sort and filters as query params on every list (`?q=`, `?sort=`,
  `?filter=`) — Inventory already does `?filter=`
- Detail pages as real routes (items 5 and 6)
- Deep-linkable editing: `/inventory/:id/edit`, `/products/:id/edit`
- Settings tabs as `?tab=`
- Back/forward behave correctly; a link to a filtered view can be bookmarked

**Do this as part of items 5 and 6, not after.** Retrofitting routing onto
finished screens costs more than building them that way.

---

## Suggested order

Dependency-driven, respecting the stated priorities:

| # | Work | Why here | Effort |
|---|---|---|---|
| 1 | **Settings page** | Small, and the rich-notes toggle lives in it | ~1 d |
| 2 | **Rich-text notes** | P0, and the Journal reuses the whole editor | ~1 d |
| 3 | **Shopify CSV export** | P0, no API or keys, immediate value | ~½ d |
| 4 | **Photos + product & material detail + URL state** | One coherent chunk; splitting it means routing twice | ~4 d |
| 5 | **Shopify read-only + linking** | P0, but depends on the product detail page existing | ~2.5 d |
| 6 | **Journal** | P1, and cheapest once the editor and links exist | ~1.5 d |

Roughly **10–11 working days**. Items 1–3 are independently shippable; 4 is the
one that must land whole.

## Decisions

- **Journal shape** — settled in §2.
- **`source_url` on materials** — yes, optional field. Lands with the material
  detail page (§6).
- **Photos** — upload order is the display order, no cap per entity.
- **CSV export** — may cover a subset (e.g. only products not yet linked to
  Shopify). An export is *not* a backup.
- **Backups must include every detail** — materials, products, the bill of
  materials, settings, fees, journal entries and **photo files**. The current
  bundle covers everything that exists today; when photos land, the backup must
  carry the files themselves, not just their metadata rows. This is the one
  place where "good enough" is not acceptable, since a database has already been
  lost once on this project.

## Still open

1. Shopify sync — manual button only, or a daily background refresh as well?
2. Global search (from §2) — ⌘K palette, or a persistent field in the header?
