import { Alert, Paper, Snackbar, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../../api/client";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { PageHeader } from "../../../components/PageHeader";
import { TableActions } from "../../../components/TableActions";
import type { Session } from "../../../types";
import { errorMessage, formatDate } from "../../../utils";

export function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [target, setTarget] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try { setSessions((await apiRequest<{ items: Session[] }>("/api/admin/sessions?limit=100")).items); setError(""); }
    catch (caught) { setError(errorMessage(caught, "Unable to load sessions.")); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function revoke() {
    if (!target) return;
    try { await apiRequest(`/api/admin/sessions/${target.id}`, { method: "DELETE" }); setTarget(null); setNotice("Session revoked."); await load(); }
    catch (caught) { setError(errorMessage(caught)); }
  }

  return (
    <><PageHeader title="Sessions" subtitle="Review and revoke active server-side sessions." />{error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}
      <TableContainer component={Paper} variant="outlined"><Table><TableHead><TableRow><TableCell>User</TableCell><TableCell>Scope</TableCell><TableCell>IP</TableCell><TableCell>Created</TableCell><TableCell>Last seen</TableCell><TableCell>Expires</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>
        {sessions.map((session) => <TableRow key={session.id}><TableCell>{session.user?.username ?? session.userId}</TableCell><TableCell>{session.application?.hostname ?? "Central SSO"}</TableCell><TableCell>{session.ip ?? "—"}</TableCell><TableCell>{formatDate(session.createdAt)}</TableCell><TableCell>{formatDate(session.lastSeenAt)}</TableCell><TableCell>{formatDate(session.expiresAt)}</TableCell><TableCell align="right"><TableActions label={`Actions for ${session.user?.username ?? session.userId}`} actions={[{ label: "Revoke", destructive: true, onClick: () => setTarget(session) }]} /></TableCell></TableRow>)}
        {!sessions.length && <TableRow><TableCell colSpan={7}>No active sessions.</TableCell></TableRow>}
      </TableBody></Table></TableContainer>
      <ConfirmDialog open={Boolean(target)} title="Revoke session" message={`Revoke the session for ${target?.user?.username ?? "this user"}?`} confirmLabel="Revoke" onCancel={() => setTarget(null)} onConfirm={() => void revoke()} />
      <Snackbar open={Boolean(notice)} autoHideDuration={3000} onClose={() => setNotice("")} message={notice} />
    </>
  );
}
