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
import type { Application, Group } from "../../../types";
import { errorMessage } from "../../../utils";

interface ApplicationForm { id?: string; name: string; hostname: string; enabled: boolean }
interface Permission { group: Group; allowed: boolean }
const emptyForm: ApplicationForm = { name: "", hostname: "", enabled: true };

export function ApplicationsAdminPage() {
  const { createOpen, openCreate, closeCreate } = useCreateDialogParams();
  const [applications, setApplications] = useState<Application[]>([]);
  const [form, setForm] = useState<ApplicationForm | null>(null);
  const [permissionApp, setPermissionApp] = useState<Application | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setApplications((await apiRequest<{ items: Application[] }>("/api/admin/applications")).items); setError(""); }
    catch (caught) { setError(errorMessage(caught, "Unable to load applications.")); }
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
      const saved = await apiRequest<Application>(form.id ? `/api/admin/applications/${form.id}` : "/api/admin/applications", { method: form.id ? "PATCH" : "POST", body: JSON.stringify({ name: form.name, hostname: form.hostname, enabled: form.enabled }) });
      closeForm(); setNotice(creating ? "Application created." : "Application updated."); await load();
      if (creating) await openPermissions(saved);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setSaving(false); }
  }

  async function openPermissions(application: Application) {
    setPermissionApp(application);
    try { setPermissions((await apiRequest<{ items: Permission[] }>(`/api/admin/applications/${application.id}/groups`)).items); }
    catch (caught) { setError(errorMessage(caught)); }
  }

  async function updatePermission(groupId: string, allowed: boolean) {
    if (!permissionApp) return;
    setPermissions((items) => items.map((item) => item.group.id === groupId ? { ...item, allowed } : item));
    try {
      await apiRequest(`/api/admin/applications/${permissionApp.id}/groups/${groupId}`, { method: "PUT", body: JSON.stringify({ allowed }) });
      setNotice("Permission updated.");
    } catch (caught) {
      setPermissions((items) => items.map((item) => item.group.id === groupId ? { ...item, allowed: !allowed } : item));
      setError(errorMessage(caught));
    }
  }

  async function deleteApplication() {
    if (!deleteTarget) return;
    try { await apiRequest(`/api/admin/applications/${deleteTarget.id}`, { method: "DELETE" }); setDeleteTarget(null); setNotice("Application deleted."); await load(); }
    catch (caught) { setError(errorMessage(caught)); }
  }

  return (
    <>
      <PageHeader title="Applications" subtitle="Register protected hostnames and grant group access." action="Add application" onAction={openCreate} />
      {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}
      <TableContainer component={Paper} variant="outlined"><Table><TableHead><TableRow><TableCell>Name</TableCell><TableCell>Hostname</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>
        {applications.map((application) => <TableRow key={application.id}><TableCell>{application.name}</TableCell><TableCell>{application.hostname}</TableCell><TableCell><StatusChip enabled={Boolean(application.enabled)} /></TableCell><TableCell align="right"><TableActions label={`Actions for ${application.name}`} actions={[{ label: "Edit", onClick: () => { if (createOpen) closeCreate(); setForm({ id: application.id, name: application.name, hostname: application.hostname, enabled: Boolean(application.enabled) }); } }, { label: "Permissions", onClick: () => void openPermissions(application) }, { label: "Delete", destructive: true, onClick: () => setDeleteTarget(application) }]} /></TableCell></TableRow>)}
        {!applications.length && <TableRow><TableCell colSpan={4}>No applications.</TableCell></TableRow>}
      </TableBody></Table></TableContainer>

      <Dialog open={Boolean(form)} onClose={closeForm} maxWidth="sm" fullWidth><Stack component="form" onSubmit={(event) => void save(event)}><DialogTitle>{form?.id ? "Edit application" : "Add application"}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <LabeledTextField label="Name" placeholder="Application name" value={form?.name ?? ""} onChange={(event) => setForm((value) => value && ({ ...value, name: event.target.value }))} required autoFocus />
        <LabeledTextField label="Hostname" helperText="Hostname only, without protocol or path" placeholder="jellyfin.example.com" value={form?.hostname ?? ""} onChange={(event) => setForm((value) => value && ({ ...value, hostname: event.target.value }))} required />
        <FormControlLabel control={<Switch checked={form?.enabled ?? true} onChange={(event) => setForm((value) => value && ({ ...value, enabled: event.target.checked }))} />} label="Enabled" />
      </Stack></DialogContent><DialogActions><Button onClick={closeForm}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? "Saving…" : "Save"}</Button></DialogActions></Stack></Dialog>

      <Dialog open={Boolean(permissionApp)} onClose={() => setPermissionApp(null)} maxWidth="sm" fullWidth><DialogTitle>Permissions · {permissionApp?.name}</DialogTitle><DialogContent><Typography color="text.secondary" sx={{ mb: 2 }}>Administrators always have access. Other users require an enabled group below.</Typography>
        <ToggleListCard title="Groups" emptyLabel="No groups available." items={permissions.map((permission) => ({ id: permission.group.id, label: <span>{permission.group.name}<Typography component="span" color="text.secondary" sx={{ ml: 1, fontSize: 13 }}>{permission.group.enabled ? "" : "disabled"}</Typography></span>, checked: permission.allowed, ariaLabel: `${permission.group.name} access`, onChange: (checked) => void updatePermission(permission.group.id, checked) }))} />
      </DialogContent><DialogActions><Button onClick={() => setPermissionApp(null)}>Close</Button></DialogActions></Dialog>

      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete application" message={`Delete ${deleteTarget?.name ?? "this application"} and all its permissions?`} confirmLabel="Delete" onCancel={() => setDeleteTarget(null)} onConfirm={() => void deleteApplication()} />
      <Snackbar open={Boolean(notice)} autoHideDuration={3000} onClose={() => setNotice("")} message={notice} />
    </>
  );
}
