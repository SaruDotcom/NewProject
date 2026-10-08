import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { Toaster } from "@/components/ui/sonner";
import { StoreProvider } from "@/state/store";
import "@/styles.css";
import App from "@/App";
import { muiTheme } from "@/theme/mui";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <StoreProvider>
        <App />
        <Toaster />
      </StoreProvider>
    </ThemeProvider>
  </StrictMode>,
);
