// Generic HTTP client wrapper.
// Uses fetch to avoid extra dependencies (axios optional).

function defaultApiBaseUrl() {
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:8000`;
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
