import { createContext, useContext, useMemo, useReducer } from "react";
import { uid } from "../../utils/ids.js";
import { totalCost } from "../../utils/calc/costMath.js";

const CalculationContext = createContext(null);

const initialState = {
  // tracks whether draft is tied to an existing product
  activeProductId: null,

  name: "Untitled Product",
  notes: "",
  workedHours: 0,
  laborRate: 0,
  salePrice: 0,

  rowsById: {},
  rowOrder: [],
};

function reducer(state, action) {
  switch (action.type) {
    case "setAll":
      return { ...state, ...action.payload };

    case "setMeta":
      return { ...state, [action.key]: action.value };

    case "setActiveProductId":
      return { ...state, activeProductId: action.id ?? null };

    case "addRow": {
      const row = action.row;
      return {
        ...state,
        rowsById: { ...state.rowsById, [row.rowId]: row },
        rowOrder: [...state.rowOrder, row.rowId],
      };
    }

    case "removeRow": {
      const { [action.rowId]: _, ...rest } = state.rowsById;
      return {
        ...state,
        rowsById: rest,
        rowOrder: state.rowOrder.filter((id) => id !== action.rowId),
      };
    }

    case "patchRow": {
      const prev = state.rowsById[action.rowId];
      if (!prev) return state;
      return {
        ...state,
        rowsById: {
          ...state.rowsById,
          [action.rowId]: { ...prev, ...action.patch },
        },
      };
    }

    case "clear":
      // clear draft AND detach from any product
      return { ...initialState };

    default:
      return state;
  }
}

export function CalculationProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const api = useMemo(() => {
    const rows = state.rowOrder.map((id) => state.rowsById[id]).filter(Boolean);
    const totals = totalCost({
      rows,
      workedHours: state.workedHours,
      laborRate: state.laborRate,
    });

    const addRowFromMaterial = (material) => {
      const rowId = uid("row");
      dispatch({
        type: "addRow",
        row: {
          rowId,
          materialId: material?.id ?? null,
          name: material?.name || "Material",
          base_cost: material?.base_cost ?? 0,
          base_qty: material?.base_qty ?? 1,
          used_qty: 0,
        },
      });
    };

    return {
      state,
      rows,
      totals,

      // meta
      setMeta: (key, value) => dispatch({ type: "setMeta", key, value }),
      setActiveProductId: (id) => dispatch({ type: "setActiveProductId", id }),

      // rows
      addEmptyRow: () => addRowFromMaterial(null),
      addMaterialAsRow: (material) => {
        if (!material) return;
        addRowFromMaterial(material);
      },

      addCommonMaterials: (materials) => {
        const existingMaterialIds = new Set(rows.map((r) => r.materialId));
        (materials || []).forEach((m) => {
          if (!m || existingMaterialIds.has(m.id)) return;
          addRowFromMaterial(m);
        });
      },

      removeRow: (rowId) => dispatch({ type: "removeRow", rowId }),
      patchRow: (rowId, patch) => dispatch({ type: "patchRow", rowId, patch }),

      // draft lifecycle
      clearDraft: () => dispatch({ type: "clear" }),

      loadDraftState: (draft) => {
        if (!draft || typeof draft !== "object") return;

        // When importing a draft JSON, treat it as a NEW draft unless it includes activeProductId explicitly
        const next = { ...initialState, ...draft };
        dispatch({ type: "setAll", payload: next });
      },

      loadFromProduct: (product) => {
        if (!product) return;

        const rowsById = {};
        const rowOrder = [];
        (product.rows || []).forEach((r) => {
          const rowId = uid("row");
          rowsById[rowId] = { ...r, rowId };
          rowOrder.push(rowId);
        });

        dispatch({
          type: "setAll",
          payload: {
            ...initialState,
            activeProductId: product.id ?? null,
            name: product.name || "Untitled Product",
            notes: product.notes || "",
            workedHours: product.workedHours ?? 0,
            laborRate: product.laborRate ?? 0,
            rowsById,
            rowOrder,
          },
        });
      },

      // payloads
      toProductPayload: () => {
        return {
          // include id if we are editing an existing product
          id: state.activeProductId ?? undefined,

          name: state.name,
          notes: state.notes,
          workedHours: state.workedHours,
          laborRate: state.laborRate,

          rows: rows.map(({ rowId, ...rest }) => rest),

          // totals can be stored for convenience, but backend can also recompute
          totals,
        };
      },

      /**
       * Save current draft into ProductsProvider (create or update).
       * - If draft has activeProductId => update that product (no duplicates).
       * - Else ProductsProvider.save() will apply "no duplicates by name" logic.
       * After saving, we bind activeProductId to the returned product id.
       */
      saveToProducts: async (productsApi) => {
        if (!productsApi?.save) {
          throw new Error("saveToProducts requires ProductsProvider API");
        }

        const payload = api.toProductPayload();
        console.log("Payload to save => ", payload);
        const saved = await productsApi.save(payload);

        // Bind this draft to the saved record so next Save updates instead of creating duplicates
        if (saved?.id) {
          dispatch({ type: "setActiveProductId", id: saved.id });
        }

        return saved;
      },
    };
    // IMPORTANT: depend on state only; api.toProductPayload is referenced but safe since api is memoized
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <CalculationContext.Provider value={api}>
      {children}
    </CalculationContext.Provider>
  );
}

export function useCalculation() {
  const ctx = useContext(CalculationContext);
  if (!ctx)
    throw new Error("useCalculation must be used within CalculationProvider");
  return ctx;
}
