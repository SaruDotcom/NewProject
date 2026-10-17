import { createTheme } from "@mui/material/styles";
import { tradeflowMuiTokens } from "@/theme/tokens";

export const muiTheme = createTheme({
  palette: {
    primary: { main: tradeflowMuiTokens.green, contrastText: tradeflowMuiTokens.navy },
    secondary: { main: tradeflowMuiTokens.gray100, contrastText: tradeflowMuiTokens.navy },
    error: { main: tradeflowMuiTokens.danger },
    background: { default: tradeflowMuiTokens.page, paper: tradeflowMuiTokens.white },
    text: { primary: tradeflowMuiTokens.navy, secondary: tradeflowMuiTokens.gray500 },
  },
  shape: { borderRadius: 7 },
  typography: {
    fontFamily: '"Inter", sans-serif',
    button: { textTransform: "none", fontWeight: 700 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTextField: { defaultProps: { variant: "outlined" } },
    MuiSelect: { defaultProps: { variant: "outlined" } },
  },
});