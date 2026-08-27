import { Alert, Button } from "@mui/material";
import { Link, useSearchParams } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";

export function AuthErrorPage() {
  const [params] = useSearchParams();
  const message = params.get("reason") === "invalid_authorization_code"
    ? "The authorization request has expired or has already been used."
    : "The authorization request could not be completed.";

  return (
    <AuthShell title="Authorization failed" subtitle="Return to the application and try again.">
      <Alert severity="error">{message}</Alert>
      <Button component={Link} to="/" variant="contained">Go to applications</Button>
    </AuthShell>
  );
}
