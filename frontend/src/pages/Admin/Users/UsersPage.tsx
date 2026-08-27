import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Paper, Snackbar, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../../../api/client";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { LabeledTextField } from "../../../components/FormField";
import { PageHeader } from "../../../components/PageHeader";
import { TableActions } from "../../../components/TableActions";
import { ToggleListCard } from "../../../components/ToggleListCard";
import { useCreateDialogParams } from "../../../hooks/useCreateDialogParams";
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
}

const emptyForm: UserForm = { username: "", email: "", password: "", role: "user", enabled: true, accessStartsAt: "", accessEndsAt: "" };

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
  const { createOpen, openCreate, closeCreate } = useCreateDialogParams();
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<UserForm | null>(null);
  const [manageUserId, setManageUserId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const managedUser = users.find((user) => user.id === manageUserId) ?? null;

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
  useEffect(() => {
    if (createOpen) setForm((current) => current?.id ? { ...emptyForm } : current ?? { ...emptyForm });
    else setForm((current) => current?.id ? current : null);
  }, [createOpen]);

  function closeForm() {
    setForm(null);
    if (createOpen) closeCreate();
  }

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
      ...(!form.id || form.password ? { password: form.password } : {}),
    };
    const creating = !form.id;
    try {
      const saved = await apiRequest<User>(form.id ? `/api/admin/users/${form.id}` : "/api/admin/users", { method: form.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      closeForm();
      setNotice(creating ? "User created." : "User updated.");
      await load();
      if (creating) setManageUserId(saved.id);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setSaving(false); }
  }

  async function revokeSessions(user: User) {
    try {
      const result = await apiRequest<{ revoked: number }>(`/api/admin/users/${user.id}/sessions`, { method: "DELETE" });
      setNotice(`${result.revoked} session(s) revoked.`);
    } catch (caught) { setError(errorMessage(caught)); }
  }

  async function updateGroup(groupId: string, member: boolean) {
    if (!managedUser) return;
    const previous = managedUser.groupIds ?? [];
    setUsers((items) => items.map((user) => user.id === managedUser.id ? { ...user, groupIds: member ? [...new Set([...previous, groupId])] : previous.filter((id) => id !== groupId) } : user));
    try {
      await apiRequest(`/api/admin/groups/${groupId}/members/${managedUser.id}`, { method: "PUT", body: JSON.stringify({ member }) });
      setNotice("Assignment updated.");
    } catch (caught) {
      setUsers((items) => items.map((user) => user.id === managedUser.id ? { ...user, groupIds: previous } : user));
      setError(errorMessage(caught));
    }
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
    if (createOpen) closeCreate();
    setForm({
      id: user.id,
      username: user.username,
      email: user.email ?? "",
      password: "",
      role: user.role,
      enabled: Boolean(user.enabled),
      accessStartsAt: dateInput(user.accessStartsAt),
      accessEndsAt: dateInput(user.accessEndsAt),
    });
  }

  return (
    <>
      <PageHeader title="Users" subtitle="Manage accounts, validity windows, groups and sessions." action="Add user" onAction={openCreate} />
      {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}
      <TableContainer component={Paper} variant="outlined"><Table><TableHead><TableRow><TableCell>Username</TableCell><TableCell>Email</TableCell><TableCell>Role</TableCell><TableCell>Groups</TableCell><TableCell>Access window</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>
        {users.map((user) => { const status = userStatus(user); const names = groups.filter((group) => user.groupIds?.includes(group.id)).map((group) => group.name); return <TableRow key={user.id}><TableCell><Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><span>{user.username}</span>{user.role === "admin" && <Chip size="small" color="primary" label="Admin" />}</Stack></TableCell><TableCell>{user.email || "—"}</TableCell><TableCell>{user.role}</TableCell><TableCell>{names.join(", ") || "—"}</TableCell><TableCell>{formatDate(user.accessStartsAt)} → {formatDate(user.accessEndsAt)}</TableCell><TableCell><Chip size="small" label={status.label} color={status.color} variant={status.color === "success" ? "filled" : "outlined"} /></TableCell><TableCell align="right"><TableActions label={`Actions for ${user.username}`} actions={[{ label: "Edit", onClick: () => editUser(user) }, { label: "Assignments", onClick: () => setManageUserId(user.id) }, { label: "Revoke sessions", onClick: () => void revokeSessions(user) }, { label: "Delete", destructive: true, onClick: () => setDeleteTarget(user) }]} /></TableCell></TableRow>; })}
        {!users.length && <TableRow><TableCell colSpan={7}>No users.</TableCell></TableRow>}
      </TableBody></Table></TableContainer>

      <Dialog open={Boolean(form)} onClose={closeForm} maxWidth="sm" fullWidth><Stack component="form" onSubmit={(event) => void save(event)}><DialogTitle>{form?.id ? "Edit user" : "Add user"}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <LabeledTextField label="Username" placeholder="Username" value={form?.username ?? ""} onChange={(event) => setForm((value) => value && ({ ...value, username: event.target.value }))} required autoFocus />
        <LabeledTextField label="Email" placeholder="name@example.com" type="email" value={form?.email ?? ""} onChange={(event) => setForm((value) => value && ({ ...value, email: event.target.value }))} />
        <LabeledTextField label={form?.id ? "New password (leave blank to keep current)" : "Password"} placeholder={form?.id ? "Leave blank to keep current password" : "At least 12 characters"} type="password" value={form?.password ?? ""} onChange={(event) => setForm((value) => value && ({ ...value, password: event.target.value }))} required={!form?.id} slotProps={{ htmlInput: { minLength: form?.password ? 12 : undefined } }} />
        <LabeledTextField select label="Role" placeholder="Select a role" value={form?.role ?? "user"} onChange={(event) => setForm((value) => value && ({ ...value, role: event.target.value as "admin" | "user" }))}><MenuItem value="user">User</MenuItem><MenuItem value="admin">Admin</MenuItem></LabeledTextField>
        <LabeledTextField label="Access starts" placeholder="Select a start date" type="datetime-local" value={form?.accessStartsAt ?? ""} onChange={(event) => setForm((value) => value && ({ ...value, accessStartsAt: event.target.value }))} />
        <LabeledTextField label="Access ends" placeholder="Select an end date" type="datetime-local" value={form?.accessEndsAt ?? ""} onChange={(event) => setForm((value) => value && ({ ...value, accessEndsAt: event.target.value }))} />
        <FormControlLabel control={<Switch checked={form?.enabled ?? true} onChange={(event) => setForm((value) => value && ({ ...value, enabled: event.target.checked }))} />} label="Enabled" />
      </Stack></DialogContent><DialogActions><Button onClick={closeForm}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? "Saving…" : "Save"}</Button></DialogActions></Stack></Dialog>

      <Dialog open={Boolean(managedUser)} onClose={() => setManageUserId(null)} maxWidth="sm" fullWidth><DialogTitle>Assignments · {managedUser?.username}</DialogTitle><DialogContent sx={{ pt: 1 }}>
        <ToggleListCard title="Groups" emptyLabel="No groups available." items={groups.map((group) => ({ id: group.id, label: <span>{group.name}<Typography component="span" color="text.secondary" sx={{ ml: 1, fontSize: 13 }}>{group.enabled ? "" : "disabled"}</Typography></span>, checked: managedUser?.groupIds?.includes(group.id) ?? false, ariaLabel: `${group.name} membership`, onChange: (checked) => void updateGroup(group.id, checked) }))} />
      </DialogContent><DialogActions><Button onClick={() => setManageUserId(null)}>Close</Button></DialogActions></Dialog>

      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete user" message={`Delete ${deleteTarget?.username ?? "this user"} and revoke all sessions?`} confirmLabel="Delete" onCancel={() => setDeleteTarget(null)} onConfirm={() => void deleteUser()} />
      <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice("")} message={notice} />
    </>
  );
}
