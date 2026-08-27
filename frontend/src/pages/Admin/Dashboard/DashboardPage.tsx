import { Alert, Card, CardActionArea, CardContent, CircularProgress, Grid, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { apiRequest } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";

interface Dashboard { users: number; groups: number; applications: number; sessions: number; accessDenied: number }

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const stats = data ? [
    { label: "Users", value: data.users, to: "/admin/users" },
    { label: "Groups", value: data.groups, to: "/admin/groups" },
    { label: "Applications", value: data.applications, to: "/admin/applications" },
    { label: "Active sessions", value: data.sessions, to: "/admin/sessions" },
    { label: "Denied requests", value: data.accessDenied, to: "/admin/audit-logs" },
  ] : [];
  useEffect(() => { void apiRequest<Dashboard>("/api/admin/dashboard").then(setData).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load dashboard.")); }, []);

  return (
    <><PageHeader title="Dashboard" subtitle="Authentication service overview." />{error && <Alert severity="error">{error}</Alert>}{!data && !error && <CircularProgress />}
      {data && <Grid container spacing={2}>{stats.map(({ label, value, to }) => <Grid key={label} size={{ xs: 12, sm: 6, xl: 3 }}><Card sx={{ height: "100%" }}><CardActionArea component={RouterLink} to={to} sx={{ height: "100%" }}><CardContent><Typography variant="h3" sx={{ fontWeight: 750 }}>{value}</Typography><Typography color="text.secondary">{label}</Typography></CardContent></CardActionArea></Card></Grid>)}</Grid>}
    </>
  );
}
