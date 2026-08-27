import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#8b6cff" },
    background: { default: "#080b10", paper: "#111720" },
    divider: "#253041",
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    h1: { fontSize: "1.8rem", fontWeight: 750 },
    h2: { fontSize: "1.25rem", fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 650 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiCard: { styleOverrides: { root: { border: "1px solid #253041", backgroundImage: "none" } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiTableCell: { styleOverrides: { head: { color: "#9ba8ba", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" } } },
  },
});
