import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import DashboardPage from "@/pages/DashboardPage";
import InventoryPage from "@/pages/InventoryPage";
import ProductsPage from "@/pages/ProductsPage";
import CalculatorPage from "@/pages/CalculatorPage";
import ComingSoonPage from "@/pages/ComingSoonPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="/calculator" element={<CalculatorPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route
          path="/settings"
          element={
            <ComingSoonPage
              title="Settings"
              detail="Labor rate, tax, fees and default profit live in the database with v2's values; this screen makes them editable."
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
