import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../../client/endpoints/products.api.js";

import { useAuth } from "../../hooks/auth/AuthProvider.jsx";

const ProductsContext = createContext(null);

const initialState = { items: [], loading: true };

function reducer(state, action) {
  switch (action.type) {
    case "set":
      return { ...state, items: action.items, loading: false };
    case "loading":
      return { ...state, loading: true };
    default:
      return state;
  }
}

function normalizeName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function toApiProduct(uiProduct) {
  const rows = uiProduct.rows || uiProduct.materials || []; // tolerate both names

  const materials = rows.map((r) => ({
    material_id: r.materialId ?? r.material_id ?? null,
    name: r.name,
    base_cost: Number(r.base_cost ?? 0),
    base_qty: Number(r.base_qty ?? 1),
    used_qty: Number(r.used_qty ?? 0),
    // optional: supplier/description if you ever want
    supplier: r.supplier,
  }));

  const cost =
    uiProduct.cost ??
    uiProduct.totals?.total ??
    uiProduct.totals?.grandTotal ??
    0;

  return {
    // include id only if your backend uses it for PUT, otherwise omit
    ...(uiProduct.id ? { id: uiProduct.id } : {}),

    name: uiProduct.name,
    materials, //API expects this name
    cost: Number(cost ?? 0), //API expects cost
    sale_price: Number(uiProduct.sale_price ?? uiProduct.salePrice ?? 0),
    photos: uiProduct.photos ?? [], // can be []
    notes: uiProduct.notes ?? "",
    active: uiProduct.active ?? true,
    worked_hours: uiProduct.workedHours ?? 0,
    labor_rate: uiProduct.laborRate ?? 0,
    last_updated: new Date().toLocaleDateString(),
  };
}

function fromApiProduct(apiProduct) {
  return {
    id: apiProduct.id,
    name: apiProduct.name ?? "Untitled Product",
    notes: apiProduct.notes ?? "",
    active: apiProduct.active ?? true,

    // Keep sale price fields available in UI if you add it later
    salePrice: apiProduct.sale_price ?? 0,

    // Convert API materials[] back into UI draft rows array
    rows: (apiProduct.materials || []).map((m) => ({
      materialId: m.material_id ?? m.materialId ?? null,
      name: m.name ?? "Material",
      base_cost: m.base_cost ?? 0,
      base_qty: m.base_qty ?? 1,
      used_qty: m.used_qty ?? 0,
    })),

    // optionally store cost if you want
    totals: { total: apiProduct.cost ?? 0 },
    workedHours: apiProduct.worked_hours,
    laborRate: apiProduct.labor_rate,
    lastUpdated: apiProduct.last_updated,
  };
}

export function ProductsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const auth = useAuth();
  const authenticated = auth.isAuthed && !auth.booting;

  const refresh = async () => {
    dispatch({ type: "loading" });
    const items = await listProducts();
    dispatch({ type: "set", items: (items || []).map(fromApiProduct) });
  };

  useEffect(() => {
    // if (authenticated)
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const api = useMemo(() => {
    return {
      state,
      products: state.items,
      loading: state.loading,

      refresh,

      getOne: async (id) => {
        const prod = await getProduct(id);
        return fromApiProduct(prod);
      },

      // Upsert with duplicate prevention by name (case/space insensitive)
      save: async (product) => {
        console.log("Product to save => ", product);
        if (!product) throw new Error("Missing product payload");

        const incomingName = normalizeName(product.name);
        if (!incomingName) throw new Error("Product name is required");

        const apiProduct = toApiProduct(product);

        // 1) If ID provided -> update that
        const hasId =
          apiProduct.id !== undefined &&
          apiProduct.id !== null &&
          apiProduct.id !== "";
        if (hasId) {
          const saved = await updateProduct(apiProduct.id, apiProduct);
          await refresh();
          return saved;
        }

        // 2) No ID: prevent duplicates by name
        const match = state.items.find(
          (p) => normalizeName(p.name) === incomingName
        );

        if (match?.id) {
          const saved = await updateProduct(match.id, {
            ...apiProduct,
            id: match.id,
          });
          await refresh();
          return saved;
        }

        // 3) Otherwise create new
        const saved = await createProduct(apiProduct);
        await refresh();
        return saved;
      },

      remove: async (id) => {
        await deleteProduct(id);
        await refresh();
      },

      // Same comment as materials: true replace requires backend support.
      replaceAll: async (nextItems) => {
        // delete removed
        const existingIds = new Set(
          state.items.map((p) => p.id).filter(Boolean)
        );
        const nextIds = new Set(
          (nextItems || []).map((p) => p.id).filter(Boolean)
        );

        for (const id of existingIds) {
          if (!nextIds.has(id)) await deleteProduct(id);
        }

        // upsert next
        for (const p of nextItems || []) {
          const hasId = p && p.id !== undefined && p.id !== null && p.id !== "";
          if (hasId) await updateProduct(p.id, p);
          else await createProduct(p);
        }

        await refresh();
      },
    };
  }, [state.items, state.loading]);

  return (
    <ProductsContext.Provider value={api}>{children}</ProductsContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProducts must be used within ProductsProvider");
  return ctx;
}
