import { alpha, createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#8b5cf6" },
    background: { default: "#09090b", paper: "#141416" },
    divider: "rgba(255, 255, 255, 0.08)",
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    h1: { fontSize: "1.8rem", fontWeight: 750 },
    h2: { fontSize: "1.25rem", fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 650 },
  },
  components: {
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiCard: { styleOverrides: { root: { border: "1px solid rgba(255, 255, 255, 0.08)", backgroundImage: "none" } } },
    MuiChip: {
      defaultProps: { variant: "outlined" },
      styleOverrides: {
        root: ({ theme }) => {
          const ghostColor = (color: string) => ({ color, borderColor: alpha(color, 0.32), backgroundColor: alpha(color, 0.08) });
          return {
            borderRadius: theme.shape.borderRadius,
            color: theme.palette.text.secondary,
            border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
            backgroundColor: alpha(theme.palette.common.white, 0.04),
            "&.MuiChip-colorPrimary": ghostColor(theme.palette.primary.main),
            "&.MuiChip-colorSecondary": ghostColor(theme.palette.secondary.main),
            "&.MuiChip-colorSuccess": ghostColor(theme.palette.success.main),
            "&.MuiChip-colorWarning": ghostColor(theme.palette.warning.main),
            "&.MuiChip-colorError": ghostColor(theme.palette.error.main),
            "&.MuiChip-colorInfo": ghostColor(theme.palette.info.main),
          };
        },
      },
    },
    MuiFormControl: { defaultProps: { size: "small" } },
    MuiOutlinedInput: { defaultProps: { size: "small" } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiSelect: { defaultProps: { size: "small" } },
    MuiSwitch: {
      styleOverrides: {
        root: ({ theme }) => ({
          width: 28,
          height: 16,
          padding: 0,
          display: "flex",
          ".MuiFormControlLabel-labelPlacementEnd &": { marginRight: theme.spacing(1) },
          ".MuiFormControlLabel-labelPlacementStart &": { marginLeft: theme.spacing(1) },
          "&:active": {
            "& .MuiSwitch-thumb": { width: 15 },
            "& .MuiSwitch-switchBase.Mui-checked": { transform: "translateX(9px)" },
          },
          "& .MuiSwitch-switchBase": {
            padding: 2,
            "&.Mui-checked": {
              transform: "translateX(12px)",
              color: theme.palette.common.white,
              "& + .MuiSwitch-track": { opacity: 1, backgroundColor: theme.palette.primary.main },
            },
          },
          "& .MuiSwitch-thumb": {
            width: 12,
            height: 12,
            borderRadius: 6,
            boxShadow: "0 2px 4px rgb(0 0 0 / 25%)",
            transition: theme.transitions.create("width", { duration: 200 }),
          },
          "& .MuiSwitch-track": {
            borderRadius: 8,
            opacity: 1,
            backgroundColor: alpha(theme.palette.common.white, 0.24),
            boxSizing: "border-box",
          },
          "& .MuiSwitch-switchBase.Mui-disabled + .MuiSwitch-track": { opacity: 0.35 },
        }),
      },
    },
    MuiTableCell: { styleOverrides: { head: { color: "#a1a1aa", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" } } },
    MuiTextField: { defaultProps: { size: "small" } },
  },
});
