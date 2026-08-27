import { Alert, Box, Button, CircularProgress, Stack, TextField } from "@mui/material";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { AuthShell } from "../../components/AuthShell";

export function LoginPage() {
  const { user, loading, login, continueWithState, settings } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const continued = useRef(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const state = params.get("state") ?? undefined;

  useEffect(() => {
    if (loading || !user || continued.current) return;
    continued.current = true;
    if (state) {
      void continueWithState(state).then((destination) => window.location.assign(destination)).catch(() => navigate(user.role === "admin" ? "/admin" : "/", { replace: true }));
    } else {
      navigate(user.role === "admin" ? "/admin" : "/", { replace: true });
    }
  }, [continueWithState, loading, navigate, state, user]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const destination = await login(username, password, state);
      window.location.assign(destination);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Sign-in failed.");
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Sign in" subtitle="Continue to your protected applications.">
      {error && <Alert severity="error">{error}</Alert>}
      <Stack component="form" spacing={2} onSubmit={(event) => void submit(event)}>
        <TextField label="Username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required autoFocus />
        <TextField label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
        <Button type="submit" variant="contained" size="large" disabled={submitting || loading}>{submitting ? <CircularProgress size={22} /> : "Sign in"}</Button>
      </Stack>
      {settings.signupEnabled && <Box sx={{ textAlign: "center", "& a": { color: "primary.light" } }}><RouterLink to="/signup">Create an account</RouterLink></Box>}
    </AuthShell>
  );
}
