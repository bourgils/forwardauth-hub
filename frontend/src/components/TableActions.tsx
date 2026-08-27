import { Divider, IconButton, Menu, MenuItem, SvgIcon } from "@mui/material";
import { Fragment, useId, useState, type MouseEvent } from "react";
import { actionMenuListStyles, actionPopoverPaperStyles } from "./actionMenuStyles";

export interface TableAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

export function TableActions({ actions, label = "Open actions" }: { actions: TableAction[]; label?: string }) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const menuId = useId();

  function selectAction(action: TableAction) {
    setAnchorEl(null);
    action.onClick();
  }

  return (
    <>
      <IconButton
        size="small"
        aria-label={label}
        aria-controls={anchorEl ? menuId : undefined}
        aria-expanded={anchorEl ? "true" : undefined}
        aria-haspopup="menu"
        disabled={!actions.length}
        onClick={(event: MouseEvent<HTMLButtonElement>) => setAnchorEl(event.currentTarget)}
        sx={{ width: 32, height: 32, border: 1, borderColor: "divider", borderRadius: "4px", color: "text.secondary" }}
      >
        <SvgIcon fontSize="small"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></SvgIcon>
      </IconButton>
      <Menu
        id={menuId}
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { ...actionPopoverPaperStyles, minWidth: 160, mt: 0.5 } }, list: { sx: actionMenuListStyles } }}
      >
        {actions.map((action, index) => <Fragment key={`${action.label}-${index}`}>
          {action.destructive && index > 0 && !actions[index - 1]?.destructive && <Divider />}
          <MenuItem disabled={action.disabled} onClick={() => selectAction(action)} sx={action.destructive ? { color: "error.main" } : undefined}>{action.label}</MenuItem>
        </Fragment>)}
      </Menu>
    </>
  );
}
