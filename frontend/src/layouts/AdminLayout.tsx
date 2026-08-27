import { AppBar, Box, Button, Stack, Toolbar, Typography } from "@mui/material";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AccountPopover } from "../components/AccountPopover";

const navigation = [
  { label: "Overview", items: [["Dashboard", "/admin"]] },
  { label: "Access management", items: [["Users", "/admin/users"], ["Groups", "/admin/groups"], ["Applications", "/admin/applications"]] },
  { label: "Monitoring", items: [["Activity", "/admin/activity"], ["Sessions", "/admin/sessions"], ["Audit logs", "/admin/audit-logs"]] },
] as const;

export function AdminLayout() {
  const { settings } = useAuth();

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar><Typography sx={{ flexGrow: 1, fontWeight: 800 }}>{settings.appName}</Typography><AccountPopover /></Toolbar>
      </AppBar>
      <Box sx={{ display: { md: "grid" }, gridTemplateColumns: "230px minmax(0, 1fr)", minHeight: "calc(100vh - 64px)" }}>
        <Box component="aside" sx={(theme) => ({ borderRight: { md: `1px solid ${theme.palette.divider}` }, borderBottom: { xs: `1px solid ${theme.palette.divider}`, md: 0 }, p: 2 })}>
          <Stack component="nav" aria-label="Administration" direction={{ xs: "row", md: "column" }} sx={{ overflowX: "auto", gap: 2 }}>
            {navigation.map((section) => <Box key={section.label} sx={{ flex: "0 0 auto" }}>
              <Typography sx={{ px: 1.5, mb: 0.5, color: "text.disabled", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>{section.label}</Typography>
              <Stack direction={{ xs: "row", md: "column" }} sx={{ gap: 0.5 }}>
                {section.items.map(([label, to]) => <Button key={to} component={NavLink} to={to} end={to === "/admin"} sx={{ flex: "0 0 auto", justifyContent: "flex-start", px: 1.5, color: "text.secondary", whiteSpace: "nowrap", "&.active": { bgcolor: "action.selected", color: "text.primary" } }}>{label}</Button>)}
              </Stack>
            </Box>)}
          </Stack>
        </Box>
        <Box component="main" sx={{ p: { xs: 2, sm: 3, lg: 4 }, minWidth: 0 }}><Outlet /></Box>
      </Box>
    </Box>
  );
}
