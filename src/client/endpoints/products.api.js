import { http } from "../httpClient";

// GET /api/products
export async function listProducts() {
  const data = await http.get("/products");
  return data;
}

// GET /api/products/:id
export async function getProduct(id) {
  const data = await http.get(`/products/${id}`);
  return data;
}

// POST /api/products
export async function createProduct(payload) {
  const data = await http.post("/products", payload);
  return data;
}

// PUT /api/products/:id
export async function updateProduct(id, payload) {
  const data = await http.put(`/products/${id}`, payload);
  return data;
}

// DELETE /api/products/:id
export async function deleteProduct(id) {
  await http.delete(`/products/${id}`);
}
