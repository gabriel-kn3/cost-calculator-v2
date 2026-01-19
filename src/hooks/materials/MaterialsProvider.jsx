import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import {
  listMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
} from "../../client/endpoints/materials.api.js";

const MaterialsContext = createContext(null);

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

export function MaterialsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const refresh = async () => {
    dispatch({ type: "loading" });
    const items = await listMaterials();
    console.log("Materials provider, listMaterials() => ", items);
    dispatch({ type: "set", items: Array.isArray(items) ? items : [] });
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const api = useMemo(() => {
    const common = state.items.filter((m) =>
      String(m.name || "").includes("*")
    );

    return {
      state,
      materials: state.items,
      loading: state.loading,
      commonMaterials: common,

      refresh,

      save: async (material) => {
        if (!material || typeof material !== "object") {
          throw new Error("Invalid material payload");
        }

        const hasId =
          material.id !== undefined &&
          material.id !== null &&
          material.id !== "";

        let saved;

        if (hasId) {
          // UPDATE → id is required
          saved = await updateMaterial(material.id, material);
        } else {
          // CREATE → MUST NOT send id (even id: null breaks Supabase)
          const payload = { ...material };
          delete payload.id;

          saved = await createMaterial(payload);
        }

        await refresh();
        return saved;
      },

      remove: async (id) => {
        await deleteMaterial(id);
        await refresh();
      },

      // Keep API compatible with your UI, but implement as "replace" client-side
      // until you add a backend bulk endpoint.
      replaceAll: async (nextItems) => {
        // naive replace: delete missing, upsert existing/new
        // If you want true replace semantics, add /materials/replace in backend later.
        const existingIds = new Set(
          state.items.map((m) => m.id).filter(Boolean)
        );
        const nextIds = new Set(
          (nextItems || []).map((m) => m.id).filter(Boolean)
        );

        // delete removed
        for (const id of existingIds) {
          if (!nextIds.has(id)) {
            await deleteMaterial(id);
          }
        }

        // upsert next
        for (const m of nextItems || []) {
          const hasId = m && m.id !== undefined && m.id !== null && m.id !== "";
          if (hasId) await updateMaterial(m.id, m);
          else await createMaterial(m);
        }

        await refresh();
      },
    };
  }, [state.items, state.loading]); // refresh is stable enough in this file

  return (
    <MaterialsContext.Provider value={api}>
      {children}
    </MaterialsContext.Provider>
  );
}

export function useMaterials() {
  const ctx = useContext(MaterialsContext);
  if (!ctx)
    throw new Error("useMaterials must be used within MaterialsProvider");
  return ctx;
}
