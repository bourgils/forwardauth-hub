import { Alert, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel, ListItemText, MenuItem, OutlinedInput, Paper, Select, Snackbar, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from "@mui/material";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../../../api/client";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { PageHeader } from "../../../components/PageHeader";
import type { Group, User } from "../../../types";
import { errorMessage, formatDate } from "../../../utils";

interface UserForm {
  id?: string;
  username: string;
  email: string;
  password: string;
  role: "admin" | "user";
  enabled: boolean;
  accessStartsAt: string;
  accessEndsAt: string;
  groupIds: string[];
}

const emptyForm: UserForm = { username: "", email: "", password: "", role: "user", enabled: true, accessStartsAt: "", accessEndsAt: "", groupIds: [] };

function dateInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function datePayload(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function userStatus(user: User): { label: string; color: "success" | "default" | "warning" } {
  if (!user.enabled) return { label: "Disabled", color: "default" };
  const now = Date.now();
  if (user.accessStartsAt && new Date(user.accessStartsAt).getTime() > now) return { label: "Scheduled", color: "warning" };
  if (user.accessEndsAt && new Date(user.accessEndsAt).getTime() <= now) return { label: "Expired", color: "default" };
  return { label: "Active", color: "success" };
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<UserForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [userResult, groupResult] = await Promise.all([
        apiRequest<{ items: User[] }>("/api/admin/users?limit=100"),
        apiRequest<{ items: Group[] }>("/api/admin/groups"),
      ]);
      setUsers(userResult.items);
      setGroups(groupResult.items);
      setError("");
    } catch (caught) { setError(errorMessage(caught, "Unable to load users.")); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    const payload = {
      username: form.username,
      email: form.email,
      role: form.role,
      enabled: form.enabled,
      accessStartsAt: datePayload(form.accessStartsAt),
      accessEndsAt: datePayload(form.accessEndsAt),
      groupIds: form.groupIds,
      ...(!form.id || form.password ? { password: form.password } : {}),
    };
    try {
      await apiRequest(form.id ? `/api/admin/users/${form.id}` : "/api/admin/users", { method: form.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setForm(null);
      setNotice(form.id ? "User updated." : "User created.");
      await load();
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setSaving(false); }
  }

  async function revokeSessions(user: User) {
    try {
      const result = await apiRequest<{ revoked: number }>(`/api/admin/users/${user.id}/sessions`, { method: "DELETE" });
      setNotice(`${result.revoked} session(s) revoked.`);
    } catch (caught) { setError(errorMessage(caught)); }
  }

  async function deleteUser() {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      setNotice("User deleted.");
      await load();
    } catch (caught) { setError(errorMessage(caught)); }
  }

  function editUser(user: User) {
    setForm({
      id: user.id,
      username: user.username,
      email: user.email ?? "",
      password: "",
      role: user.role,
      enabled: Boolean(user.enabled),
      accessStartsAt: dateInput(user.accessStartsAt),
      accessEndsAt: dateInput(user.accessEndsAt),
      groupIds: user.groupIds ?? [],
    });
  }

  return (
    <>
      <PageHeader title="Users" subtitle="Manage accounts, validity windows, groups and sessions." action="Add user" onAction={() => setForm({ ...emptyForm })} />
      {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}
      <TableContainer component={Paper} variant="outlined"><Table><TableHead><TableRow><TableCell>Username</TableCell><TableCell>Email</TableCell><TableCell>Role</TableCell><TableCell>Groups</TableCell><TableCell>Access window</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>
        {users.map((user) => { const status = userStatus(user); const names = groups.filter((group) => user.groupIds?.includes(group.id)).map((group) => group.name); return <TableRow key={user.id}><TableCell>{user.username}</TableCell><TableCell>{user.email || "—"}</TableCell><TableCell>{user.role}</TableCell><TableCell>{names.join(", ") || "—"}</TableCell><TableCell>{formatDate(user.accessStartsAt)} → {formatDate(user.accessEndsAt)}</TableCell><TableCell><Chip size="small" label={status.label} color={status.color} variant={status.color === "success" ? "filled" : "outlined"} /></TableCell><TableCell><Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}><Button size="small" onClick={() => editUser(user)}>Edit</Button><Button size="small" onClick={() => void revokeSessions(user)}>Revoke sessions</Button><Button size="small" color="error" onClick={() => setDeleteTarget(user)}>Delete</Button></Stack></TableCell></TableRow>; })}
        {!users.length && <TableRow><TableCell colSpan={7}>No users.</TableCell></TableRow>}
      </TableBody></Table></TableContainer>

      <Dialog open={Boolean(form)} onClose={() => setForm(null)} maxWidth="sm" fullWidth><Stack component="form" onSubmit={(event) => void save(event)}><DialogTitle>{form?.id ? "Edit user" : "Add user"}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <TextField label="Username" value={form?.username ?? ""} onChange={(event) => setForm((value) => value && ({ ...value, username: event.target.value }))} required autoFocus />
        <TextField label="Email" type="email" value={form?.email ?? ""} onChange={(event) => setForm((value) => value && ({ ...value, email: event.target.value }))} />
        <TextField label={form?.id ? "New password (leave blank to keep current)" : "Password"} type="password" value={form?.password ?? ""} onChange={(event) => setForm((value) => value && ({ ...value, password: event.target.value }))} required={!form?.id} slotProps={{ htmlInput: { minLength: form?.password ? 12 : undefined } }} />
        <TextField select label="Role" value={form?.role ?? "user"} onChange={(event) => setForm((value) => value && ({ ...value, role: event.target.value as "admin" | "user" }))}><MenuItem value="user">User</MenuItem><MenuItem value="admin">Admin</MenuItem></TextField>
        <FormControl><InputLabel id="user-groups-label">Groups</InputLabel><Select labelId="user-groups-label" multiple value={form?.groupIds ?? []} onChange={(event) => setForm((value) => value && ({ ...value, groupIds: typeof event.target.value === "string" ? event.target.value.split(",") : event.target.value }))} input={<OutlinedInput label="Groups" />} renderValue={(selected) => groups.filter((group) => selected.includes(group.id)).map((group) => group.name).join(", ")}>
          {groups.map((group) => <MenuItem key={group.id} value={group.id}><Checkbox checked={form?.groupIds.includes(group.id) ?? false} /><ListItemText primary={group.name} secondary={group.enabled ? undefined : "Disabled"} /></MenuItem>)}
        </Select></FormControl>
        <TextField label="Access starts" type="datetime-local" value={form?.accessStartsAt ?? ""} onChange={(event) => setForm((value) => value && ({ ...value, accessStartsAt: event.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label="Access ends" type="datetime-local" value={form?.accessEndsAt ?? ""} onChange={(event) => setForm((value) => value && ({ ...value, accessEndsAt: event.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
        <FormControlLabel control={<Switch checked={form?.enabled ?? true} onChange={(event) => setForm((value) => value && ({ ...value, enabled: event.target.checked }))} />} label="Enabled" />
      </Stack></DialogContent><DialogActions><Button onClick={() => setForm(null)}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? "Saving…" : "Save"}</Button></DialogActions></Stack></Dialog>

      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete user" message={`Delete ${deleteTarget?.username ?? "this user"} and revoke all sessions?`} confirmLabel="Delete" onCancel={() => setDeleteTarget(null)} onConfirm={() => void deleteUser()} />
      <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice("")} message={notice} />
    </>
  );
}
