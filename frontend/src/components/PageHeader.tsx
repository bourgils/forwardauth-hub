import { Box, Button, Typography } from "@mui/material";

export function PageHeader({ title, subtitle, action, onAction }: { title: string; subtitle?: string; action?: string; onAction?: () => void }) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, mb: 3 }}>
      <Box><Typography component="h1" variant="h1">{title}</Typography>{subtitle && <Typography color="text.secondary" sx={{ mt: 0.75 }}>{subtitle}</Typography>}</Box>
      {action && <Button variant="contained" onClick={onAction}>{action}</Button>}
    </Box>
  );
}
