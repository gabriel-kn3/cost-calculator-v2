// Generic HTTP client wrapper.
// Uses fetch to avoid extra dependencies (axios optional).

function defaultApiBaseUrl() {
  // Same-origin. The API is served under /api by the same Node process that
  // serves this app, so there is no second port, no CORS, and no cookie
  // SameSite problem. The previous `${protocol}//${hostname}:8000` form is
  // why this app could never work behind a tunnel: a tunnel exposes 443 only.
  return "/api";
}

export function createHttpClient({ baseUrl = "" } = {}) {
  async function request(path, { method = "GET", headers = {}, body } = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `HTTP ${res.status}`);
    }

    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await res.json();
    return await res.text();
  }

  return {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: "POST", body }),
    put: (path, body) => request(path, { method: "PUT", body }),
    del: (path) => request(path, { method: "DELETE" }),
  };
}

export const http = createHttpClient({ baseUrl: defaultApiBaseUrl() });
