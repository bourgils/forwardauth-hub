import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Paper, Snackbar, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from "@mui/material";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../../../api/client";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { PageHeader } from "../../../components/PageHeader";
import { StatusChip } from "../../../components/StatusChip";
import type { User } from "../../../types";
import { errorMessage } from "../../../utils";

interface UserForm { id?: string; username: string; email: string; password: string; role: "admin" | "user"; enabled: boolean }
const emptyForm: UserForm = { username: "", email: "", password: "", role: "user", enabled: true };

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<UserForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setUsers((await apiRequest<{ items: User[] }>("/api/admin/users?limit=100")).items); setError(""); }
    catch (caught) { setError(errorMessage(caught, "Unable to load users.")); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    const payload = { username: form.username, email: form.email, role: form.role, enabled: form.enabled, ...(!form.id || form.password ? { password: form.password } : {}) };
    try {
      await apiRequest(form.id ? `/api/admin/users/${form.id}` : "/api/admin/users", { method: form.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setForm(null); setNotice(form.id ? "User updated." : "User created."); await load();
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setSaving(false); }
  }

  async function revokeSessions(user: User) {
    try { const result = await apiRequest<{ revoked: number }>(`/api/admin/users/${user.id}/sessions`, { method: "DELETE" }); setNotice(`${result.revoked} session(s) revoked.`); }
    catch (caught) { setError(errorMessage(caught)); }
  }

  async function deleteUser() {
    if (!deleteTarget) return;
    try { await apiRequest(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" }); setDeleteTarget(null); setNotice("User deleted."); await load(); }
    catch (caught) { setError(errorMessage(caught)); }
  }

  return (
    <>
      <PageHeader title="Users" subtitle="Manage accounts, roles, passwords and sessions." action="Add user" onAction={() => setForm({ ...emptyForm })} />
      {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}
      <TableContainer component={Paper} variant="outlined"><Table><TableHead><TableRow><TableCell>Username</TableCell><TableCell>Email</TableCell><TableCell>Role</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>
        {users.map((user) => <TableRow key={user.id}><TableCell>{user.username}</TableCell><TableCell>{user.email || "—"}</TableCell><TableCell>{user.role}</TableCell><TableCell><StatusChip enabled={Boolean(user.enabled)} /></TableCell><TableCell><Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}><Button size="small" onClick={() => setForm({ id: user.id, username: user.username, email: user.email ?? "", password: "", role: user.role, enabled: Boolean(user.enabled) })}>Edit</Button><Button size="small" onClick={() => void revokeSessions(user)}>Revoke sessions</Button><Button size="small" color="error" onClick={() => setDeleteTarget(user)}>Delete</Button></Stack></TableCell></TableRow>)}
        {!users.length && <TableRow><TableCell colSpan={5}>No users.</TableCell></TableRow>}
      </TableBody></Table></TableContainer>

      <Dialog open={Boolean(form)} onClose={() => setForm(null)} maxWidth="sm" fullWidth><Stack component="form" onSubmit={(event) => void save(event)}><DialogTitle>{form?.id ? "Edit user" : "Add user"}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <TextField label="Username" value={form?.username ?? ""} onChange={(event) => setForm((value) => value && ({ ...value, username: event.target.value }))} required autoFocus />
        <TextField label="Email" type="email" value={form?.email ?? ""} onChange={(event) => setForm((value) => value && ({ ...value, email: event.target.value }))} />
        <TextField label={form?.id ? "New password (leave blank to keep current)" : "Password"} type="password" value={form?.password ?? ""} onChange={(event) => setForm((value) => value && ({ ...value, password: event.target.value }))} required={!form?.id} slotProps={{ htmlInput: { minLength: form?.password ? 12 : undefined } }} />
        <TextField select label="Role" value={form?.role ?? "user"} onChange={(event) => setForm((value) => value && ({ ...value, role: event.target.value as "admin" | "user" }))}><MenuItem value="user">User</MenuItem><MenuItem value="admin">Admin</MenuItem></TextField>
        <FormControlLabel control={<Switch checked={form?.enabled ?? true} onChange={(event) => setForm((value) => value && ({ ...value, enabled: event.target.checked }))} />} label="Enabled" />
      </Stack></DialogContent><DialogActions><Button onClick={() => setForm(null)}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? "Saving…" : "Save"}</Button></DialogActions></Stack></Dialog>

      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete user" message={`Delete ${deleteTarget?.username ?? "this user"} and revoke all sessions?`} confirmLabel="Delete" onCancel={() => setDeleteTarget(null)} onConfirm={() => void deleteUser()} />
      <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice("")} message={notice} />
    </>
  );
}
