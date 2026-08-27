import { Alert, Box, Button, CircularProgress, Stack, TextField } from "@mui/material";
import { useState, type FormEvent } from "react";
import { Link as RouterLink, Navigate, useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { AuthShell } from "../../components/AuthShell";

export function SignupPage() {
  const { settings, loading, signup } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && !settings.signupEnabled) return <Navigate to="/login" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await signup(username, email, password);
      navigate("/login", { replace: true, state: { accountCreated: true } });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Account creation failed.");
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Create account" subtitle="An administrator must grant application access.">
      {error && <Alert severity="error">{error}</Alert>}
      <Stack component="form" spacing={2} onSubmit={(event) => void submit(event)}>
        <TextField label="Username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required autoFocus />
        <TextField label="Email (optional)" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
        <TextField label="Password" helperText="At least 12 characters" type="password" value={password} onChange={(event) => setPassword(event.target.value)} slotProps={{ htmlInput: { minLength: 12 } }} autoComplete="new-password" required />
        <Button type="submit" variant="contained" size="large" disabled={submitting || loading}>{submitting ? <CircularProgress size={22} /> : "Create account"}</Button>
      </Stack>
      <Box sx={{ textAlign: "center", "& a": { color: "primary.light" } }}><RouterLink to="/login">Back to sign in</RouterLink></Box>
    </AuthShell>
  );
}
