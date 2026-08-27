import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Paper, Snackbar, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../../../api/client";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { LabeledTextField } from "../../../components/FormField";
import { PageHeader } from "../../../components/PageHeader";
import { StatusChip } from "../../../components/StatusChip";
import { TableActions } from "../../../components/TableActions";
import { ToggleListCard } from "../../../components/ToggleListCard";
import { useCreateDialogParams } from "../../../hooks/useCreateDialogParams";
import type { Application, Group, User } from "../../../types";
import { errorMessage } from "../../../utils";

interface GroupForm { id?: string; name: string; description: string; enabled: boolean }
const emptyForm: GroupForm = { name: "", description: "", enabled: true };

export function GroupsPage() {
  const { createOpen, openCreate, closeCreate } = useCreateDialogParams();
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
    const creating = !form.id;
    try {
      const saved = await apiRequest<Group>(form.id ? `/api/admin/groups/${form.id}` : "/api/admin/groups", { method: form.id ? "PATCH" : "POST", body: JSON.stringify({ name: form.name, description: form.description, enabled: form.enabled }) });
      closeForm();
      setNotice(creating ? "Group created." : "Group updated.");
      await load();
      if (creating) setManageGroupId(saved.id);
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
      <PageHeader title="Groups" subtitle="Assign users and application access through lightweight RBAC." action="Add group" onAction={openCreate} />
      {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}
      <TableContainer component={Paper} variant="outlined"><Table><TableHead><TableRow><TableCell>Name</TableCell><TableCell>Description</TableCell><TableCell>Members</TableCell><TableCell>Applications</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>
        {groups.map((group) => <TableRow key={group.id}><TableCell>{group.name}</TableCell><TableCell>{group.description || "—"}</TableCell><TableCell>{group.userIds.length}</TableCell><TableCell>{group.applicationIds.length}</TableCell><TableCell><StatusChip enabled={group.enabled} /></TableCell><TableCell align="right"><TableActions label={`Actions for ${group.name}`} actions={[{ label: "Edit", onClick: () => { if (createOpen) closeCreate(); setForm({ id: group.id, name: group.name, description: group.description ?? "", enabled: group.enabled }); } }, { label: "Assignments", onClick: () => setManageGroupId(group.id) }, { label: "Delete", destructive: true, onClick: () => setDeleteTarget(group) }]} /></TableCell></TableRow>)}
        {!groups.length && <TableRow><TableCell colSpan={6}>No groups.</TableCell></TableRow>}
      </TableBody></Table></TableContainer>

      <Dialog open={Boolean(form)} onClose={closeForm} maxWidth="sm" fullWidth><Stack component="form" onSubmit={(event) => void save(event)}><DialogTitle>{form?.id ? "Edit group" : "Add group"}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <LabeledTextField label="Name" placeholder="Group name" value={form?.name ?? ""} onChange={(event) => setForm((value) => value && ({ ...value, name: event.target.value }))} required autoFocus />
        <LabeledTextField label="Description" placeholder="Describe this group's purpose" multiline minRows={2} value={form?.description ?? ""} onChange={(event) => setForm((value) => value && ({ ...value, description: event.target.value }))} />
        <FormControlLabel control={<Switch checked={form?.enabled ?? true} onChange={(event) => setForm((value) => value && ({ ...value, enabled: event.target.checked }))} />} label="Enabled" />
      </Stack></DialogContent><DialogActions><Button onClick={closeForm}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? "Saving…" : "Save"}</Button></DialogActions></Stack></Dialog>

      <Dialog open={Boolean(managedGroup)} onClose={() => setManageGroupId(null)} maxWidth="sm" fullWidth><DialogTitle>Assignments · {managedGroup?.name}</DialogTitle><DialogContent><Stack spacing={3} sx={{ pt: 1 }}>
        <ToggleListCard title="Members" emptyLabel="No users." items={users.map((user) => ({ id: user.id, label: user.username, checked: managedGroup?.userIds.includes(user.id) ?? false, onChange: (checked) => void updateMember(user.id, checked) }))} />
        <ToggleListCard title="Applications" emptyLabel="No applications." items={applications.map((application) => ({ id: application.id, label: <span>{application.name}<Typography component="span" color="text.secondary" sx={{ ml: 1, fontSize: 13 }}>{application.hostname}</Typography></span>, checked: managedGroup?.applicationIds.includes(application.id) ?? false, onChange: (checked) => void updateApplication(application.id, checked) }))} />
      </Stack></DialogContent><DialogActions><Button onClick={() => setManageGroupId(null)}>Close</Button></DialogActions></Dialog>

      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete group" message={`Delete ${deleteTarget?.name ?? "this group"} and all its assignments?`} confirmLabel="Delete" onCancel={() => setDeleteTarget(null)} onConfirm={() => void deleteGroup()} />
      <Snackbar open={Boolean(notice)} autoHideDuration={3000} onClose={() => setNotice("")} message={notice} />
    </>
  );
}
