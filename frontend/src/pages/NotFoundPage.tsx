import { Button, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return <Stack sx={{ minHeight: "100vh", alignItems: "center", justifyContent: "center" }} spacing={2}><Typography variant="h1">Page not found</Typography><Button component={Link} to="/" variant="contained">Go home</Button></Stack>;
}
