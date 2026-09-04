/**
 * React Query hooks. These replace v2's four hand-rolled context providers,
 * along with their habit of refetching an entire collection after every single
 * write -- which is what made Import an N+1 storm.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { WireMaterial, WireProduct } from "@shared/types";

export const keys = {
  health: ["health"] as const,
  me: ["auth", "me"] as const,
  materials: ["materials"] as const,
  products: ["products"] as const,
  settings: ["settings"] as const,
};

export function useHealth() {
  return useQuery({
    queryKey: keys.health,
    queryFn: api.health,
    // v2 polled every 60s; keep the same cadence so the pill behaves as before.
    refetchInterval: 60_000,
    retry: false,
  });
}

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: api.auth.me, retry: false });
}

export function useMaterials() {
  return useQuery({ queryKey: keys.materials, queryFn: api.materials.list });
}

export function useProducts() {
  return useQuery({ queryKey: keys.products, queryFn: api.products.list });
}

export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: api.settings.get });
}

export function useSaveMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (m: Partial<WireMaterial>) =>
      m.id ? api.materials.update(String(m.id), m) : api.materials.create(m),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.materials }),
  });
}

export function useDeleteMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.materials.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.materials }),
  });
}

export function useSaveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Partial<WireProduct>) =>
      p.id ? api.products.update(String(p.id), p) : api.products.save(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.products }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.products.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.products }),
  });
}
