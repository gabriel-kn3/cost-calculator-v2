// Optional helper if you later want to load theme.json dynamically.
export async function loadThemeJson(url = "/src/theme/theme.json") {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load theme json: ${res.status}`);
  return await res.json();
}
