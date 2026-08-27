import { Alert, Card, CardActionArea, CardContent, CircularProgress, Grid, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { apiRequest } from "../../api/client";
import type { Application } from "../../types";

export function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void apiRequest<{ items: Application[] }>("/api/auth/applications")
      .then((result) => setApplications(result.items))
      .catch(() => setError("Unable to load applications."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Stack spacing={3}>
      <div><Typography component="h1" variant="h1">Your applications</Typography><Typography color="text.secondary" sx={{ mt: 0.75 }}>Services available with your account.</Typography></div>
      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && !applications.length && <Alert severity="info">No application access has been granted.</Alert>}
      <Grid container spacing={2}>
        {applications.map((application) => (
          <Grid key={application.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={{ height: "100%" }}>
              <CardActionArea component="a" href={`https://${application.hostname}`} sx={{ height: "100%" }}>
                <CardContent><Typography variant="h2">{application.name}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{application.hostname}</Typography></CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
