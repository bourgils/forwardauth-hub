import { Chip } from "@mui/material";

export function StatusChip({ enabled, enabledLabel = "Enabled", disabledLabel = "Disabled" }: { enabled: boolean; enabledLabel?: string; disabledLabel?: string }) {
  return <Chip size="small" color={enabled ? "success" : "default"} label={enabled ? enabledLabel : disabledLabel} variant={enabled ? "filled" : "outlined"} />;
}
