import { Alert, Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { apiRequest } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";
import type { AuditLog } from "../../../types";
import { errorMessage, formatDate } from "../../../utils";

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { void apiRequest<{ items: AuditLog[] }>("/api/admin/audit-logs?limit=100").then((result) => setLogs(result.items)).catch((caught) => setError(errorMessage(caught, "Unable to load audit logs."))); }, []);

  return (
    <><PageHeader title="Audit logs" subtitle="Recent authentication and administration activity." />{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <TableContainer component={Paper} variant="outlined"><Table><TableHead><TableRow><TableCell>Time</TableCell><TableCell>Action</TableCell><TableCell>Actor</TableCell><TableCell>Application</TableCell><TableCell>IP</TableCell><TableCell>Metadata</TableCell></TableRow></TableHead><TableBody>
        {logs.map((log) => { const metadata = JSON.stringify(log.metadata ?? {}); return <TableRow key={log.id}><TableCell>{formatDate(log.createdAt)}</TableCell><TableCell><Chip size="small" label={log.action} variant="outlined" /></TableCell><TableCell>{log.user?.username ?? "—"}</TableCell><TableCell>{log.application?.name ?? "—"}</TableCell><TableCell>{log.ip ?? "—"}</TableCell><TableCell><Tooltip title={metadata}><Typography noWrap sx={{ maxWidth: 260, fontFamily: "monospace", fontSize: 12 }}>{metadata}</Typography></Tooltip></TableCell></TableRow>; })}
        {!logs.length && <TableRow><TableCell colSpan={6}>No audit logs.</TableCell></TableRow>}
      </TableBody></Table></TableContainer>
    </>
  );
}
