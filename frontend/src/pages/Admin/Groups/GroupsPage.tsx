import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Paper, Snackbar, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../../../api/client";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { PageHeader } from "../../../components/PageHeader";
import { StatusChip } from "../../../components/StatusChip";
import type { Application, Group, User } from "../../../types";
import { errorMessage } from "../../../utils";

interface GroupForm { id?: string; name: string; description: string; enabled: boolean }

export function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [form, setForm] = useState<GroupForm | null>(null);
  const [manageGroupId, setManageGroupId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const managedGroup = groups.find((group) => group.id === manageGroupId) ?? null;

  const load = useCallback(async () => {
    try {
      const [groupResult, userResult, applicationResult] = await Promise.all([
        apiRequest<{ items: Group[] }>("/api/admin/groups"),
        apiRequest<{ items: User[] }>("/api/admin/users?limit=100"),
        apiRequest<{ items: Application[] }>("/api/admin/applications"),
      ]);
      setGroups(groupResult.items);
      setUsers(userResult.items);
      setApplications(applicationResult.items);
      setError("");
    } catch (caught) { setError(errorMessage(caught, "Unable to load groups.")); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      await apiRequest(form.id ? `/api/admin/groups/${form.id}` : "/api/admin/groups", { method: form.id ? "PATCH" : "POST", body: JSON.stringify({ name: form.name, description: form.description, enabled: form.enabled }) });
      setForm(null);
      setNotice(form.id ? "Group updated." : "Group created.");
      await load();
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setSaving(false); }
  }

  async function updateMember(userId: string, member: boolean) {
    if (!managedGroup) return;
    const previous = managedGroup.userIds;
    setGroups((items) => items.map((group) => group.id === managedGroup.id ? { ...group, userIds: member ? [...new Set([...group.userIds, userId])] : group.userIds.filter((id) => id !== userId) } : group));
    try {
      await apiRequest(`/api/admin/groups/${managedGroup.id}/members/${userId}`, { method: "PUT", body: JSON.stringify({ member }) });
      setNotice("Membership updated.");
    } catch (caught) {
      setGroups((items) => items.map((group) => group.id === managedGroup.id ? { ...group, userIds: previous } : group));
      setError(errorMessage(caught));
    }
  }

  async function updateApplication(applicationId: string, allowed: boolean) {
    if (!managedGroup) return;
    const previous = managedGroup.applicationIds;
    setGroups((items) => items.map((group) => group.id === managedGroup.id ? { ...group, applicationIds: allowed ? [...new Set([...group.applicationIds, applicationId])] : group.applicationIds.filter((id) => id !== applicationId) } : group));
    try {
      await apiRequest(`/api/admin/groups/${managedGroup.id}/applications/${applicationId}`, { method: "PUT", body: JSON.stringify({ allowed }) });
      setNotice("Application access updated.");
    } catch (caught) {
      setGroups((items) => items.map((group) => group.id === managedGroup.id ? { ...group, applicationIds: previous } : group));
      setError(errorMessage(caught));
    }
  }

  async function deleteGroup() {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/api/admin/groups/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      setNotice("Group deleted.");
      await load();
    } catch (caught) { setError(errorMessage(caught)); }
  }

  return (
    <>
      <PageHeader title="Groups" subtitle="Assign users and application access through lightweight RBAC." action="Add group" onAction={() => setForm({ name: "", description: "", enabled: true })} />
      {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}
      <TableContainer component={Paper} variant="outlined"><Table><TableHead><TableRow><TableCell>Name</TableCell><TableCell>Description</TableCell><TableCell>Members</TableCell><TableCell>Applications</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>
        {groups.map((group) => <TableRow key={group.id}><TableCell>{group.name}</TableCell><TableCell>{group.description || "—"}</TableCell><TableCell>{group.userIds.length}</TableCell><TableCell>{group.applicationIds.length}</TableCell><TableCell><StatusChip enabled={group.enabled} /></TableCell><TableCell><Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}><Button size="small" onClick={() => setForm({ id: group.id, name: group.name, description: group.description ?? "", enabled: group.enabled })}>Edit</Button><Button size="small" onClick={() => setManageGroupId(group.id)}>Assignments</Button><Button size="small" color="error" onClick={() => setDeleteTarget(group)}>Delete</Button></Stack></TableCell></TableRow>)}
        {!groups.length && <TableRow><TableCell colSpan={6}>No groups.</TableCell></TableRow>}
      </TableBody></Table></TableContainer>

      <Dialog open={Boolean(form)} onClose={() => setForm(null)} maxWidth="sm" fullWidth><Stack component="form" onSubmit={(event) => void save(event)}><DialogTitle>{form?.id ? "Edit group" : "Add group"}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <TextField label="Name" value={form?.name ?? ""} onChange={(event) => setForm((value) => value && ({ ...value, name: event.target.value }))} required autoFocus />
        <TextField label="Description" multiline minRows={2} value={form?.description ?? ""} onChange={(event) => setForm((value) => value && ({ ...value, description: event.target.value }))} />
        <FormControlLabel control={<Switch checked={form?.enabled ?? true} onChange={(event) => setForm((value) => value && ({ ...value, enabled: event.target.checked }))} />} label="Enabled" />
      </Stack></DialogContent><DialogActions><Button onClick={() => setForm(null)}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? "Saving…" : "Save"}</Button></DialogActions></Stack></Dialog>

      <Dialog open={Boolean(managedGroup)} onClose={() => setManageGroupId(null)} maxWidth="sm" fullWidth><DialogTitle>Assignments · {managedGroup?.name}</DialogTitle><DialogContent><Stack spacing={3} sx={{ pt: 1 }}>
        <div><Typography variant="h6" sx={{ mb: 1 }}>Members</Typography><Stack>
          {users.map((user) => <FormControlLabel key={user.id} sx={{ m: 0, py: 0.5, borderBottom: 1, borderColor: "divider", justifyContent: "space-between" }} labelPlacement="start" label={user.username} control={<Switch checked={managedGroup?.userIds.includes(user.id) ?? false} onChange={(event) => void updateMember(user.id, event.target.checked)} />} />)}
          {!users.length && <Typography color="text.secondary">No users.</Typography>}
        </Stack></div>
        <div><Typography variant="h6" sx={{ mb: 1 }}>Applications</Typography><Stack>
          {applications.map((application) => <FormControlLabel key={application.id} sx={{ m: 0, py: 0.5, borderBottom: 1, borderColor: "divider", justifyContent: "space-between" }} labelPlacement="start" label={<span>{application.name}<Typography component="span" color="text.secondary" sx={{ ml: 1, fontSize: 13 }}>{application.hostname}</Typography></span>} control={<Switch checked={managedGroup?.applicationIds.includes(application.id) ?? false} onChange={(event) => void updateApplication(application.id, event.target.checked)} />} />)}
          {!applications.length && <Typography color="text.secondary">No applications.</Typography>}
        </Stack></div>
      </Stack></DialogContent><DialogActions><Button onClick={() => setManageGroupId(null)}>Close</Button></DialogActions></Dialog>

      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete group" message={`Delete ${deleteTarget?.name ?? "this group"} and all its assignments?`} confirmLabel="Delete" onCancel={() => setDeleteTarget(null)} onConfirm={() => void deleteGroup()} />
      <Snackbar open={Boolean(notice)} autoHideDuration={3000} onClose={() => setNotice("")} message={notice} />
    </>
  );
}
