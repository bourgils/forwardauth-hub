import { Alert, Box, Button, ButtonBase, Card, CardActionArea, CardContent, Chip, CircularProgress, Divider, Grid, Stack, Typography } from "@mui/material";
import { useEffect, useState, type ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import { apiRequest } from "../../../api/client";
import { PageHeader } from "../../../components/PageHeader";
import { formatDate } from "../../../utils";

interface Dashboard {
  users: { total: number; active: number; disabled: number; scheduled: number; expired: number; withoutGroup: number };
  applications: { total: number; active: number; withoutGroupAccess: number };
  groups: { total: number; disabled: number };
  sessions: { active: number; uniqueUsers: number };
  security: { accessDenied24h: number; loginFailures24h: number };
  topApplications: Array<{ id: string; name: string; hostname: string; requests: number; users: number; lastAccessAt: string }>;
  recentSecurity: Array<{ id: string; action: string; createdAt: string; ip: string | null; user: { id: string; username: string } | null; application: { id: string; name: string; hostname: string } | null }>;
}

function MetricCard({ label, value, detail, to, action }: { label: string; value: ReactNode; detail: string; to: string; action?: { label: string; to: string } }) {
  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardActionArea component={RouterLink} to={to} sx={{ flex: 1 }}>
        <CardContent>
          <Typography variant="h3" sx={{ fontWeight: 750 }}>{value}</Typography>
          <Typography sx={{ mt: 0.5, fontWeight: 650 }}>{label}</Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>{detail}</Typography>
        </CardContent>
      </CardActionArea>
      {action && <><Divider /><Box sx={{ p: 1 }}><Button component={RouterLink} to={action.to} size="small" fullWidth>{action.label}</Button></Box></>}
    </Card>
  );
}

function SectionCard({ title, action, to, children }: { title: string; action?: string; to?: string; children: ReactNode }) {
  return (
    <Card sx={{ height: "100%" }}>
      <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
        <Typography component="h2" sx={{ fontSize: 15, fontWeight: 700 }}>{title}</Typography>
        {action && to && <Button component={RouterLink} to={to} size="small">{action}</Button>}
      </Box>
      <Divider />
      {children}
    </Card>
  );
}

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { void apiRequest<Dashboard>("/api/admin/dashboard").then(setData).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load dashboard.")); }, []);

  if (error) return <><PageHeader title="Dashboard" subtitle="Authentication service overview." /><Alert severity="error">{error}</Alert></>;
  if (!data) return <><PageHeader title="Dashboard" subtitle="Authentication service overview." /><CircularProgress /></>;

  const metrics = [
    { label: "Active users", value: `${data.users.active} / ${data.users.total}`, detail: `${data.users.disabled} disabled · ${data.users.scheduled} scheduled · ${data.users.expired} expired`, to: "/admin/users", action: { label: "Add user", to: "/admin/users?open=true&action=create" } },
    { label: "Active groups", value: `${data.groups.total - data.groups.disabled} / ${data.groups.total}`, detail: `${data.groups.disabled} disabled`, to: "/admin/groups", action: { label: "Add group", to: "/admin/groups?open=true&action=create" } },
    { label: "Active applications", value: `${data.applications.active} / ${data.applications.total}`, detail: `${data.applications.withoutGroupAccess} without active group access`, to: "/admin/applications", action: { label: "Add application", to: "/admin/applications?open=true&action=create" } },
    { label: "Active sessions", value: data.sessions.active, detail: `${data.sessions.uniqueUsers} unique users`, to: "/admin/sessions" },
    { label: "Denied requests · 24h", value: data.security.accessDenied24h, detail: `${data.security.loginFailures24h} failed logins`, to: "/admin/audit-logs" },
  ];
  const accessHealth = [
    { label: "Users without a group", value: data.users.withoutGroup, to: "/admin/users" },
    { label: "Applications without permission", value: data.applications.withoutGroupAccess, to: "/admin/applications" },
    { label: "Disabled groups", value: `${data.groups.disabled} / ${data.groups.total}`, to: "/admin/groups" },
    { label: "Expired accounts", value: data.users.expired, to: "/admin/users" },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Authentication service overview." />
      <Grid container spacing={2}>
        {metrics.map((metric) => <Grid key={metric.label} size={{ xs: 12, sm: 6, lg: metric.action ? 4 : 6 }}><MetricCard {...metric} /></Grid>)}

        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard title="Top applications" action="View activity" to="/admin/activity">
            {data.topApplications.length ? <Stack divider={<Divider flexItem />}>
              {data.topApplications.map((application) => <Box key={application.id} sx={{ px: 2, py: 1.25, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 650 }} noWrap>{application.name}</Typography>
                  <Typography color="text.secondary" variant="body2" noWrap>{application.hostname} · Last access {formatDate(application.lastAccessAt)}</Typography>
                </Box>
                <Box sx={{ flex: "0 0 auto", textAlign: "right" }}>
                  <Typography sx={{ fontWeight: 700 }}>{application.requests.toLocaleString()}</Typography>
                  <Typography color="text.secondary" variant="body2">{application.users} users</Typography>
                </Box>
              </Box>)}
            </Stack> : <Typography color="text.secondary" sx={{ p: 2 }}>No successful application access recorded.</Typography>}
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard title="Access health">
            <Stack divider={<Divider flexItem />}>
              {accessHealth.map((item) => <ButtonBase key={item.label} component={RouterLink} to={item.to} sx={{ width: "100%", px: 2, py: 1.25, justifyContent: "space-between", gap: 2, color: "text.primary" }}>
                <Typography sx={{ textAlign: "left" }}>{item.label}</Typography>
                <Chip size="small" label={item.value} />
              </ButtonBase>)}
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <SectionCard title="Recent security activity" action="View audit logs" to="/admin/audit-logs">
            {data.recentSecurity.length ? <Stack divider={<Divider flexItem />}>
              {data.recentSecurity.map((event) => <Box key={event.id} sx={{ px: 2, py: 1.25, display: "flex", alignItems: "center", gap: 2 }}>
                <Chip size="small" color={event.action === "authorization_code_rejected" ? "warning" : "error"} label={event.action.replaceAll("_", " ")} />
                <Typography color="text.secondary" variant="body2" sx={{ flex: 1 }}>{[event.user?.username, event.application?.name, event.ip].filter(Boolean).join(" · ") || "Anonymous request"}</Typography>
                <Typography color="text.disabled" variant="body2">{formatDate(event.createdAt)}</Typography>
              </Box>)}
            </Stack> : <Typography color="text.secondary" sx={{ p: 2 }}>No recent security events.</Typography>}
          </SectionCard>
        </Grid>
      </Grid>
    </>
  );
}
