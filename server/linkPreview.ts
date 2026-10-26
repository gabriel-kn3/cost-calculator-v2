/**
 * Link previews for material links -- the "unfurl" WhatsApp and Jira show.
 *
 * Fetched server-side because browsers cannot read another site's HTML
 * (CORS). That makes this a server that fetches URLs on request, which is a
 * classic SSRF hole, so it is fenced in:
 *   - http/https only
 *   - every hostname is resolved and REJECTED if any address is loopback,
 *     private, link-local or otherwise non-public -- so it cannot be pointed
 *     at this machine, the router, or the LAN
 *   - redirects are followed by hand (max 5) and every hop is re-checked
 *   - 6s timeout, 1.5 MB read cap, HTML only
 *   - the route sits behind auth, so a tunnelled instance does not expose an
 *     open fetcher
 *
 * Results are cached in memory: 24h for a preview, 10 min for a failure.
 *
 * Expect some links not to preview. Amazon in particular often serves a bot
 * check instead of the page; the UI falls back to the domain.
 */
import { lookup } from "node:dns/promises";
import net from "node:net";

export interface LinkPreview {
  url: string;
  finalUrl: string;
  host: string;
  ok: boolean;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 6000;
const OK_TTL = 24 * 60 * 60_000;
const FAIL_TTL = 10 * 60_000;
const MAX_CACHE = 500;

const cache = new Map<string, { value: LinkPreview; expires: number }>();

// ------------------------------------------------------------------ SSRF guard

function isPublicIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number) as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 169 && b === 254) return false; // link-local
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT (Tailscale lives here)
  if (a >= 224) return false; // multicast / reserved
  return true;
}

function isPublicAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return isPublicIPv4(ip);
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return false;
  if (v6.startsWith("fc") || v6.startsWith("fd")) return false; // unique local
  if (v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb"))
    return false; // link-local
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
  if (mapped) return isPublicIPv4(mapped[1]!);
  return true;
}

async function assertPublicHost(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http(s) links");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) throw new Error("Refusing local address");
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || !addrs.every((a) => isPublicAddress(a.address))) {
    throw new Error("Refusing non-public address");
  }
}

// --------------------------------------------------------------------- parsing

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Reads <meta property|name="key" content="..."> in either attribute order. */
function meta(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const a = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*content=["']([^"']+)["']`, "i");
    const b = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${k}["']`, "i");
    const m = a.exec(html) ?? b.exec(html);
    if (m?.[1]) return decode(m[1]);
  }
  return null;
}

function absolute(src: string | null, base: string): string | null {
  if (!src) return null;
  try {
    const u = new URL(src, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function parse(html: string, finalUrl: string): Omit<LinkPreview, "url" | "finalUrl" | "host" | "ok"> {
  let title = meta(html, ["og:title", "twitter:title"]);
  let image = meta(html, ["og:image", "og:image:url", "twitter:image", "twitter:image:src"]);
  const description = meta(html, ["og:description", "twitter:description", "description"]);
  const siteName = meta(html, ["og:site_name"]);

  // Amazon rarely ships Open Graph tags, but its product pages carry the
  // title and the main image in predictable places. Worth special-casing:
  // nearly every material link is an Amazon listing.
  if (!title) {
    const t = /<span[^>]*id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i.exec(html);
    if (t?.[1]) title = decode(t[1]);
  }
  if (!image) {
    const hires = /id=["']landingImage["'][^>]*data-old-hires=["']([^"']+)["']/i.exec(html)
      ?? /data-old-hires=["']([^"']+)["'][^>]*id=["']landingImage["']/i.exec(html);
    const src = /id=["']landingImage["'][^>]*src=["']([^"']+)["']/i.exec(html);
    image = hires?.[1] || src?.[1] || null;
  }
  if (!title) {
    const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    if (t?.[1]) title = decode(t[1]);
  }

  return {
    title: title ? title.slice(0, 300) : null,
    description: description ? description.slice(0, 400) : null,
    image: absolute(image, finalUrl),
    siteName,
  };
}

// ----------------------------------------------------------------------- fetch

async function fetchHtml(start: URL): Promise<{ html: string; finalUrl: string }> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        // A plain browser-like request; some sites refuse unknown agents.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) throw new Error("Redirect without location");
      url = new URL(next, url);
      continue; // re-checked at the top of the loop
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) throw new Error("Not an HTML page");

    // Read at most MAX_BYTES -- a preview never needs the whole document.
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Empty body");
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
    await reader.cancel().catch(() => {});
    return { html: Buffer.concat(chunks).toString("utf8"), finalUrl: url.toString() };
  }
  throw new Error("Too many redirects");
}

/**
 * Markers of a bot wall rather than a real page. Amazon's carries an HTML
 * comment pointing at its API; generic ones say robot / captcha.
 */
function isBotWall(html: string, title: string | null): boolean {
  return (
    /automated access to Amazon data|api-services-support@amazon\.com/i.test(html) ||
    /robot check|captcha|access denied|are you a human/i.test(title ?? "") ||
    /Click the button below to continue shopping/i.test(html)
  );
}

/**
 * Many product URLs carry a readable title in the path:
 *   amazon.com/Waxed-Cotton-Cord-Black/dp/B0XXXXXXX
 * When the page itself cannot be read, that slug is an honest fallback --
 * it comes from the link she pasted, not from scraping around a block.
 */
function titleFromUrl(u: string): string | null {
  try {
    const parts = new URL(u).pathname.split("/").filter(Boolean);
    const dp = parts.findIndex((p) => p === "dp" || p === "gp");
    const slug = dp > 0 ? parts[dp - 1] : null;
    if (!slug || slug.length < 4 || !/[a-z]/i.test(slug)) return null;
    return decodeURIComponent(slug).replace(/[-_]+/g, " ").trim().slice(0, 200);
  } catch {
    return null;
  }
}

export async function getLinkPreview(raw: string): Promise<LinkPreview> {
  const url = new URL(raw); // throws on garbage; the route turns that into a 400
  const key = url.toString();

  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  let value: LinkPreview;
  try {
    const { html, finalUrl } = await fetchHtml(url);
    const parsed = parse(html, finalUrl);
    const blocked = isBotWall(html, parsed.title);
    value = {
      url: key,
      finalUrl,
      host: new URL(finalUrl).hostname.replace(/^www\./, ""),
      ok: !!parsed.title && !blocked,
      ...(blocked
        ? { title: titleFromUrl(finalUrl), description: null, image: null, siteName: null }
        : parsed),
    };
  } catch {
    value = {
      url: key,
      finalUrl: key,
      host: url.hostname.replace(/^www\./, ""),
      ok: false,
      title: titleFromUrl(key),
      description: null,
      image: null,
      siteName: null,
    };
  }

  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
  cache.set(key, { value, expires: Date.now() + (value.ok ? OK_TTL : FAIL_TTL) });
  return value;
}
