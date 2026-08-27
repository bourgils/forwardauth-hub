import { Alert, Card, CardContent, CircularProgress, Grid, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { apiRequest } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";

interface Dashboard { users: number; groups: number; applications: number; sessions: number; accessDenied: number }

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const stats: Array<[string, number]> = data ? [["Users", data.users], ["Groups", data.groups], ["Applications", data.applications], ["Active sessions", data.sessions], ["Denied requests", data.accessDenied]] : [];
  useEffect(() => { void apiRequest<Dashboard>("/api/admin/dashboard").then(setData).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load dashboard.")); }, []);

  return (
    <><PageHeader title="Dashboard" subtitle="Authentication service overview." />{error && <Alert severity="error">{error}</Alert>}{!data && !error && <CircularProgress />}
      {data && <Grid container spacing={2}>{stats.map(([label, value]) => <Grid key={label} size={{ xs: 12, sm: 6, xl: 3 }}><Card><CardContent><Typography variant="h3" sx={{ fontWeight: 750 }}>{value}</Typography><Typography color="text.secondary">{label}</Typography></CardContent></Card></Grid>)}</Grid>}
    </>
  );
}
