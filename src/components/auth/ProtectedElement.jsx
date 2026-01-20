import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/auth/AuthProvider";
import LoadingCard from "../feedback/Loading";

export default function ProtectedElement({ children }) {
  const auth = useAuth();
  const loc = useLocation();

  if (auth.booting) return <LoadingCard />; // or a loading screen
  if (!auth.isAuthed)
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;

  return children;
}
