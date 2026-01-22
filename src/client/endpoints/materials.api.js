import { http } from "../httpClient";

// GET /api/materials
export async function listMaterials() {
  const data = await http.get("/materials");
  return data;
}

// POST /api/materials
export async function createMaterial(payload) {
  const data = await http.post("/materials", payload);
  return data;
}

// PUT /api/materials/:id
export async function updateMaterial(id, payload) {
  const data = await http.put(`/materials/${id}`, payload);
  return data;
}

// DELETE /api/materials/:id
export async function deleteMaterial(id) {
  await http.del(`/materials/${id}`);
}
