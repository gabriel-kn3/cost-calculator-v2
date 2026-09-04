import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import DashboardPage from "@/pages/DashboardPage";
import InventoryPage from "@/pages/InventoryPage";
import ComingSoonPage from "@/pages/ComingSoonPage";

/**
 * Screens are ported one at a time. Anything not yet migrated renders an
 * explicit placeholder rather than falling through to the Dashboard, which
 * made working navigation look broken.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route
          path="/calculator"
          element={
            <ComingSoonPage
              title="Calculator"
              detail="Ported last, on purpose: its results are checked against a golden-master corpus built from your 17 real products before any of it ships."
            />
          }
        />
        <Route
          path="/products"
          element={
            <ComingSoonPage
              title="Saved Products"
              detail="Next up — the product grid, search, and the six sort orders."
            />
          }
        />
        <Route
          path="/settings"
          element={
            <ComingSoonPage
              title="Settings"
              detail="Labor rate, tax, fees and default profit currently live in the database with v2's values; this screen makes them editable."
            />
          }
        />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route
          path="*"
          element={
            <ComingSoonPage title="Not found" detail="That page does not exist in this app." />
          }
        />
      </Route>
    </Routes>
  );
}
