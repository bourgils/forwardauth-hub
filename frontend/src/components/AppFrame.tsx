import { AppBar, Box, Container, Toolbar, Typography } from "@mui/material";
import { Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AccountPopover } from "./AccountPopover";

export function AppFrame() {
  const { settings } = useAuth();

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography sx={{ flexGrow: 1, fontWeight: 800 }}>{settings.appName}</Typography>
          <AccountPopover />
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}><Outlet /></Container>
    </Box>
  );
}
