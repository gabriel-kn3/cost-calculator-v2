import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import DashboardPage from "@/pages/DashboardPage";

/**
 * Routes are being ported screen by screen. Anything not yet migrated still
 * lives in the v2 app (`npm run dev:legacy`) until its phase lands.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<DashboardPage />} />
      </Route>
    </Routes>
  );
}
