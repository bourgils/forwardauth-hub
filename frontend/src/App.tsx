import { lazy, Suspense } from "react";
import { Box, CircularProgress } from "@mui/material";
import { Route, Routes } from "react-router-dom";
import { RequireAdmin, RequireAuth } from "./auth/RouteGuards";
import { AppFrame } from "./components/AppFrame";
import { ApplicationsPage } from "./pages/Applications/ApplicationsPage";
import { LoginPage } from "./pages/Login/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SignupPage } from "./pages/Signup/SignupPage";
import { AuthErrorPage } from "./pages/AuthErrorPage";

const AdminLayout = lazy(() => import("./layouts/AdminLayout").then((module) => ({ default: module.AdminLayout })));
const AuditLogsPage = lazy(() => import("./pages/Admin/AuditLogs/AuditLogsPage").then((module) => ({ default: module.AuditLogsPage })));
const ApplicationsAdminPage = lazy(() => import("./pages/Admin/Applications/ApplicationsAdminPage").then((module) => ({ default: module.ApplicationsAdminPage })));
const DashboardPage = lazy(() => import("./pages/Admin/Dashboard/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const GroupsPage = lazy(() => import("./pages/Admin/Groups/GroupsPage").then((module) => ({ default: module.GroupsPage })));
const ActivityPage = lazy(() => import("./pages/Admin/Activity/ActivityPage").then((module) => ({ default: module.ActivityPage })));
const SessionsPage = lazy(() => import("./pages/Admin/Sessions/SessionsPage").then((module) => ({ default: module.SessionsPage })));
const UsersPage = lazy(() => import("./pages/Admin/Users/UsersPage").then((module) => ({ default: module.UsersPage })));

function LazyFallback() {
  return <Box sx={{ minHeight: "50vh", display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/auth/error" element={<AuthErrorPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppFrame />}><Route index element={<ApplicationsPage />} /></Route>
        <Route element={<RequireAdmin />}><Route path="/admin" element={<Suspense fallback={<LazyFallback />}><AdminLayout /></Suspense>}>
          <Route index element={<Suspense fallback={<LazyFallback />}><DashboardPage /></Suspense>} />
          <Route path="users" element={<Suspense fallback={<LazyFallback />}><UsersPage /></Suspense>} />
          <Route path="groups" element={<Suspense fallback={<LazyFallback />}><GroupsPage /></Suspense>} />
          <Route path="applications" element={<Suspense fallback={<LazyFallback />}><ApplicationsAdminPage /></Suspense>} />
          <Route path="activity" element={<Suspense fallback={<LazyFallback />}><ActivityPage /></Suspense>} />
          <Route path="sessions" element={<Suspense fallback={<LazyFallback />}><SessionsPage /></Suspense>} />
          <Route path="audit-logs" element={<Suspense fallback={<LazyFallback />}><AuditLogsPage /></Suspense>} />
        </Route></Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
