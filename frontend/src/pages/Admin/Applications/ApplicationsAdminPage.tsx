import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Paper, Snackbar, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../../../api/client";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { PageHeader } from "../../../components/PageHeader";
import { StatusChip } from "../../../components/StatusChip";
import type { Application, User } from "../../../types";
import { errorMessage } from "../../../utils";

interface ApplicationForm { id?: string; name: string; hostname: string; enabled: boolean }
interface Permission { user: User; allowed: boolean }

export function ApplicationsAdminPage() {
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

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      await apiRequest(form.id ? `/api/admin/applications/${form.id}` : "/api/admin/applications", { method: form.id ? "PATCH" : "POST", body: JSON.stringify({ name: form.name, hostname: form.hostname, enabled: form.enabled }) });
      setForm(null); setNotice(form.id ? "Application updated." : "Application created."); await load();
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setSaving(false); }
  }

  async function openPermissions(application: Application) {
    setPermissionApp(application);
    try { setPermissions((await apiRequest<{ items: Permission[] }>(`/api/admin/applications/${application.id}/access`)).items); }
    catch (caught) { setError(errorMessage(caught)); }
  }

  async function updatePermission(userId: string, allowed: boolean) {
    if (!permissionApp) return;
    setPermissions((items) => items.map((item) => item.user.id === userId ? { ...item, allowed } : item));
    try {
      await apiRequest(`/api/admin/applications/${permissionApp.id}/access/${userId}`, { method: "PUT", body: JSON.stringify({ allowed }) });
      setNotice("Permission updated.");
    } catch (caught) {
      setPermissions((items) => items.map((item) => item.user.id === userId ? { ...item, allowed: !allowed } : item));
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
      <PageHeader title="Applications" subtitle="Register protected hostnames and assign access." action="Add application" onAction={() => setForm({ name: "", hostname: "", enabled: true })} />
      {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}
      <TableContainer component={Paper} variant="outlined"><Table><TableHead><TableRow><TableCell>Name</TableCell><TableCell>Hostname</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>
        {applications.map((application) => <TableRow key={application.id}><TableCell>{application.name}</TableCell><TableCell>{application.hostname}</TableCell><TableCell><StatusChip enabled={Boolean(application.enabled)} /></TableCell><TableCell><Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}><Button size="small" onClick={() => setForm({ id: application.id, name: application.name, hostname: application.hostname, enabled: Boolean(application.enabled) })}>Edit</Button><Button size="small" onClick={() => void openPermissions(application)}>Permissions</Button><Button size="small" color="error" onClick={() => setDeleteTarget(application)}>Delete</Button></Stack></TableCell></TableRow>)}
        {!applications.length && <TableRow><TableCell colSpan={4}>No applications.</TableCell></TableRow>}
      </TableBody></Table></TableContainer>

      <Dialog open={Boolean(form)} onClose={() => setForm(null)} maxWidth="sm" fullWidth><Stack component="form" onSubmit={(event) => void save(event)}><DialogTitle>{form?.id ? "Edit application" : "Add application"}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <TextField label="Name" value={form?.name ?? ""} onChange={(event) => setForm((value) => value && ({ ...value, name: event.target.value }))} required autoFocus />
        <TextField label="Hostname" helperText="Hostname only, without protocol or path" placeholder="jellyfin.example.com" value={form?.hostname ?? ""} onChange={(event) => setForm((value) => value && ({ ...value, hostname: event.target.value }))} required />
        <FormControlLabel control={<Switch checked={form?.enabled ?? true} onChange={(event) => setForm((value) => value && ({ ...value, enabled: event.target.checked }))} />} label="Enabled" />
      </Stack></DialogContent><DialogActions><Button onClick={() => setForm(null)}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? "Saving…" : "Save"}</Button></DialogActions></Stack></Dialog>

      <Dialog open={Boolean(permissionApp)} onClose={() => setPermissionApp(null)} maxWidth="sm" fullWidth><DialogTitle>Permissions · {permissionApp?.name}</DialogTitle><DialogContent><Typography color="text.secondary" sx={{ mb: 2 }}>Default deny: only enabled rules grant access.</Typography><Stack divider={<span />}>
        {permissions.map((permission) => <FormControlLabel key={permission.user.id} sx={{ m: 0, py: 1, borderBottom: 1, borderColor: "divider", justifyContent: "space-between" }} labelPlacement="start" label={<span>{permission.user.username}<Typography component="span" color="text.secondary" sx={{ ml: 1, fontSize: 13 }}>{permission.user.role}</Typography></span>} control={<Switch checked={permission.allowed} slotProps={{ input: { "aria-label": `${permission.user.username} access` } }} onChange={(event) => void updatePermission(permission.user.id, event.target.checked)} />} />)}
        {!permissions.length && <Typography>No users available.</Typography>}
      </Stack></DialogContent><DialogActions><Button onClick={() => setPermissionApp(null)}>Close</Button></DialogActions></Dialog>

      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete application" message={`Delete ${deleteTarget?.name ?? "this application"} and all its permissions?`} confirmLabel="Delete" onCancel={() => setDeleteTarget(null)} onConfirm={() => void deleteApplication()} />
      <Snackbar open={Boolean(notice)} autoHideDuration={3000} onClose={() => setNotice("")} message={notice} />
    </>
  );
}
