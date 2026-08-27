import { Avatar, Box, Chip, Divider, IconButton, MenuItem, MenuList, Popover, Stack, Typography } from "@mui/material";
import { useId, useState, type MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function AccountPopover() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const popoverId = useId();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const inAdmin = location.pathname.startsWith("/admin");

  function navigateTo(path: string) {
    setAnchorEl(null);
    navigate(path);
  }

  async function signOut() {
    setAnchorEl(null);
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <IconButton
        aria-label="Open account menu"
        aria-controls={anchorEl ? popoverId : undefined}
        aria-expanded={anchorEl ? "true" : undefined}
        aria-haspopup="menu"
        onClick={(event: MouseEvent<HTMLButtonElement>) => setAnchorEl(event.currentTarget)}
        sx={{ p: 0.5, borderRadius: "4px" }}
      >
        <Avatar variant="rounded" sx={{ width: 32, height: 32, borderRadius: "3px", bgcolor: "primary.main", fontSize: 14, fontWeight: 750 }}>
          {user?.username.charAt(0).toUpperCase() ?? "?"}
        </Avatar>
      </IconButton>
      <Popover
        id={popoverId}
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 280, mt: 1, border: 1, borderColor: "divider", borderRadius: "4px" } } }}
      >
        <Stack direction="row" spacing={1.5} sx={{ p: 2, alignItems: "center" }}>
          <Avatar variant="rounded" sx={{ width: 40, height: 40, borderRadius: "4px", bgcolor: "primary.main", fontWeight: 750 }}>
            {user?.username.charAt(0).toUpperCase() ?? "?"}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 700 }} noWrap>{user?.username}</Typography>
            <Typography color="text.secondary" variant="body2" noWrap>{user?.email || "No email address"}</Typography>
          </Box>
          <Chip size="small" color={user?.role === "admin" ? "primary" : "default"} label={user?.role ?? "user"} />
        </Stack>
        <Divider />
        <MenuList dense sx={{ p: 0.75 }}>
          {inAdmin && <MenuItem onClick={() => navigateTo("/")}>Applications</MenuItem>}
          {!inAdmin && user?.role === "admin" && <MenuItem onClick={() => navigateTo("/admin")}>Administration</MenuItem>}
          <Divider sx={{ my: 0.75 }} />
          <MenuItem disabled={loggingOut} onClick={() => void signOut()} sx={{ color: "error.main" }}>{loggingOut ? "Signing out…" : "Sign out"}</MenuItem>
        </MenuList>
      </Popover>
    </>
  );
}
