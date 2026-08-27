import { Card, Divider, FormControlLabel, Stack, Switch, Typography } from "@mui/material";
import type { ReactNode } from "react";

export interface ToggleListItem {
  id: string;
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
  disabled?: boolean;
}

export function ToggleListCard({ title, items, emptyLabel }: { title: string; items: ToggleListItem[]; emptyLabel: string }) {
  return (
    <Card>
      <Typography component="h3" sx={{ px: 2, py: 1.5, fontSize: 14, fontWeight: 700 }}>{title}</Typography>
      <Divider />
      {items.length ? <Stack divider={<Divider flexItem />}>
        {items.map((item) => <FormControlLabel
          key={item.id}
          label={item.label}
          labelPlacement="start"
          disabled={item.disabled}
          control={<Switch checked={item.checked} slotProps={{ input: { "aria-label": item.ariaLabel } }} onChange={(event) => item.onChange(event.target.checked)} />}
          sx={{ width: "100%", m: 0, px: 2, py: 1.25, justifyContent: "space-between", "& .MuiFormControlLabel-label": { flex: 1, minWidth: 0 } }}
        />)}
      </Stack> : <Typography color="text.secondary" sx={{ p: 2 }}>{emptyLabel}</Typography>}
    </Card>
  );
}
