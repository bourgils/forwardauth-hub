import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";

export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", onCancel, onConfirm }: { open: boolean; title: string; message: string; confirmLabel?: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent><DialogContentText>{message}</DialogContentText></DialogContent>
      <DialogActions><Button onClick={onCancel}>Cancel</Button><Button color="error" variant="contained" onClick={onConfirm}>{confirmLabel}</Button></DialogActions>
    </Dialog>
  );
}
