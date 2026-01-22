import React, {
  createContext,
  useContext,
  useMemo,
  useReducer,
  useRef,
} from "react";

const AppContext = createContext(null);

const initialState = {
  dock: {
    isOpen: true,
    actions: [],
  },
  io: {
    open: false,
    mode: "export", // 'import' | 'export'
    kind: "materials",
  },
  modal: {
    open: false,
    type: null,
    data: null,
  },
  toasts: [],
};

function reducer(state, action) {
  switch (action.type) {
    case "dock.toggle":
      return { ...state, dock: { ...state.dock, isOpen: !state.dock.isOpen } };
    case "dock.setActions":
      return {
        ...state,
        dock: { ...state.dock, actions: action.actions || [] },
      };

    case "io.open":
      return {
        ...state,
        io: { open: true, mode: action.mode, kind: action.kind },
      };
    case "io.close":
      return { ...state, io: { ...state.io, open: false } };

    case "modal.open":
      return {
        ...state,
        modal: {
          open: true,
          type: action.modalType,
          data: action.data ?? null,
        },
      };
    case "modal.close":
      return { ...state, modal: { open: false, type: null, data: null } };

    case "toast.push":
      return { ...state, toasts: [...state.toasts, action.toast] };
    case "toast.dismiss":
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.id),
      };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const ioCallbackRef = useRef(null);

  const api = useMemo(() => {
    return {
      state,

      toggleDock: () => dispatch({ type: "dock.toggle" }),
      setDockActions: (actions) =>
        dispatch({ type: "dock.setActions", actions }),

      openIO: ({ kind, mode, onComplete }) => {
        ioCallbackRef.current =
          typeof onComplete === "function" ? onComplete : null;
        dispatch({ type: "io.open", kind, mode });
      },
      closeIO: () => {
        ioCallbackRef.current = null;
        dispatch({ type: "io.close" });
      },
      onIOComplete: async (payload) => {
        const cb = ioCallbackRef.current;
        ioCallbackRef.current = null;
        dispatch({ type: "io.close" });
        if (cb) await cb(payload);
      },

      openModal: (modalType, data) =>
        dispatch({ type: "modal.open", modalType, data }),
      closeModal: () => dispatch({ type: "modal.close" }),

      toast: (message, status) => {
        const id = `toast_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        dispatch({ type: "toast.push", toast: { id, message, status } });
        setTimeout(() => dispatch({ type: "toast.dismiss", id }), 3500);
      },
    };
  }, [state]);

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
