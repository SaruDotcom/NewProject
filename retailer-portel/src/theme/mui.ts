import { createTheme } from "@mui/material/styles";

export const muiTheme = createTheme({
  palette: {
    primary: { main: "#b3261e", contrastText: "#fffaf5" },
    secondary: { main: "#f2eee8", contrastText: "#3f3128" },
    error: { main: "#ba1a1a" },
    background: { default: "#fffaf5", paper: "#ffffff" },
    text: { primary: "#30241f", secondary: "#776c65" },
  },
  shape: { borderRadius: 7 },
  typography: {
    fontFamily: '"Manrope", sans-serif',
    button: { textTransform: "none", fontWeight: 700 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTextField: { defaultProps: { variant: "outlined" } },
    MuiSelect: { defaultProps: { variant: "outlined" } },
  },
});