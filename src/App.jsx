import { Routes, Route, Navigate } from "react-router-dom";

import ProtectedElement from "./components/auth/ProtectedElement.jsx";

import AppShell from "./components/layout/AppShell.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import InventoryPage from "./pages/InventoryPage.jsx";
import CalculatorPage from "./pages/CalculatorPage.jsx";
import ProductsPage from "./pages/ProductsPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Everything below is protected */}
      <Route
        element={
          <ProtectedElement>
            <AppShell />
          </ProtectedElement>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/calculator" element={<CalculatorPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
