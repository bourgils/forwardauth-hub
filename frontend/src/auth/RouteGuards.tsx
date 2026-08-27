import { Alert, Box, CircularProgress } from "@mui/material";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

function Loader() {
  return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
}

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <Outlet />;
}

export function RequireAdmin() {
  const { user, settings } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/" replace />;
  if (!settings.adminUiEnabled) return <Box sx={{ p: 4 }}><Alert severity="warning">Administration is disabled.</Alert></Box>;
  return <Outlet />;
}
