import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from "@mui/material";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function AppFrame() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function signOut() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography sx={{ flexGrow: 1, fontWeight: 800 }}>Coolify Auth</Typography>
          <Typography color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>{user?.username}</Typography>
          {user?.role === "admin" && <Button color="inherit" onClick={() => navigate("/admin")}>Administration</Button>}
          <Button color="inherit" onClick={() => void signOut()}>Sign out</Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}><Outlet /></Container>
    </Box>
  );
}
