import { Avatar, Box, Card, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 3, background: "radial-gradient(circle at 50% -10%, #35265d 0, transparent 38%)" }}>
      <Card sx={{ width: "100%", maxWidth: 420, p: { xs: 3, sm: 4 }, boxShadow: "0 28px 90px rgba(0,0,0,.45)" }}>
        <Stack spacing={2.5}>
          <Avatar variant="rounded" sx={{ width: 44, height: 44, bgcolor: "primary.main", fontWeight: 800 }}>C</Avatar>
          <Box>
            <Typography component="h1" variant="h1">{title}</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>{subtitle}</Typography>
          </Box>
          {children}
        </Stack>
      </Card>
    </Box>
  );
}
