import { Alert, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { useEffect, useState } from "react";
import { apiRequest } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";
import type { UserApplicationActivity } from "../../../types";
import { errorMessage, formatDate } from "../../../utils";

export function ActivityPage() {
  const [items, setItems] = useState<UserApplicationActivity[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void apiRequest<{ items: UserApplicationActivity[] }>("/api/admin/activity?limit=100")
      .then((result) => setItems(result.items))
      .catch((caught) => setError(errorMessage(caught, "Unable to load application activity.")));
  }, []);

  return (
    <>
      <PageHeader title="Activity" subtitle="Aggregated successful access by user and application." />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <TableContainer component={Paper} variant="outlined"><Table><TableHead><TableRow><TableCell>User</TableCell><TableCell>Application</TableCell><TableCell>First access</TableCell><TableCell>Last access</TableCell><TableCell>Requests</TableCell><TableCell>Last IP</TableCell></TableRow></TableHead><TableBody>
        {items.map((item) => <TableRow key={`${item.userId}:${item.applicationId}`}><TableCell>{item.user?.username ?? item.userId}</TableCell><TableCell>{item.application?.name ?? item.applicationId}</TableCell><TableCell>{formatDate(item.firstAccessAt)}</TableCell><TableCell>{formatDate(item.lastAccessAt)}</TableCell><TableCell>{item.accessCount}</TableCell><TableCell>{item.lastIp ?? "—"}</TableCell></TableRow>)}
        {!items.length && <TableRow><TableCell colSpan={6}>No successful application access recorded.</TableCell></TableRow>}
      </TableBody></Table></TableContainer>
    </>
  );
}
