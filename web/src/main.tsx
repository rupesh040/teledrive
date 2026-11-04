import React from "react";
import './pwa/install.js';
import { registerServiceWorker } from './pwa/register.js';
import ReactDOM from "react-dom/client";
import { Gate } from "./components/Gate.js";
import { LangProvider } from "./i18n/lang.js";
import { ThemeProvider } from "./theme/ThemeProvider.js";
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-500.css";
import "@fontsource/roboto/latin-700.css";
import "./index.css";
import './app-ui.css';

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <LangProvider>
        <Gate />
      </LangProvider>
    </ThemeProvider>
  </React.StrictMode>,
);

registerServiceWorker();
