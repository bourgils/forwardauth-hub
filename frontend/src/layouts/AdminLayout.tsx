import { AppBar, Box, Button, Divider, Stack, Toolbar, Typography } from "@mui/material";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const navigation = [
  ["Dashboard", "/admin"],
  ["Users", "/admin/users"],
  ["Applications", "/admin/applications"],
  ["Sessions", "/admin/sessions"],
  ["Audit logs", "/admin/audit-logs"],
] as const;

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function signOut() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar sx={{ gap: { xs: 0.5, sm: 2 } }}><Typography sx={{ flexGrow: 1, fontWeight: 800 }}>Coolify Auth</Typography><Button color="inherit" sx={{ whiteSpace: "nowrap" }} onClick={() => navigate("/")}>Applications</Button><Typography color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>{user?.username}</Typography><Button color="inherit" sx={{ whiteSpace: "nowrap" }} onClick={() => void signOut()}>Sign out</Button></Toolbar>
      </AppBar>
      <Box sx={{ display: { md: "grid" }, gridTemplateColumns: "230px minmax(0, 1fr)", minHeight: "calc(100vh - 64px)" }}>
        <Box component="aside" sx={{ borderRight: { md: 1 }, borderBottom: { xs: 1, md: 0 }, borderColor: "divider", p: 2 }}>
          <Typography sx={{ px: 1.5, py: 1, fontWeight: 750 }}>Administration</Typography>
          <Divider sx={{ my: 1 }} />
          <Stack direction={{ xs: "row", md: "column" }} sx={{ overflowX: "auto", gap: 0.5 }}>
            {navigation.map(([label, to]) => <Button key={to} component={NavLink} to={to} end={to === "/admin"} sx={{ flex: "0 0 auto", justifyContent: "flex-start", px: 1.5, color: "text.secondary", whiteSpace: "nowrap", "&.active": { bgcolor: "action.selected", color: "text.primary" } }}>{label}</Button>)}
          </Stack>
        </Box>
        <Box component="main" sx={{ p: { xs: 2, sm: 3, lg: 4 }, minWidth: 0 }}><Outlet /></Box>
      </Box>
    </Box>
  );
}
