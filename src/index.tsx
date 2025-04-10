// src/index.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./authConfig";

// Create an MSAL instance using your configuration
const msalInstance = new PublicClientApplication(msalConfig);

// Ensure the root element exists
const container = document.getElementById("root");
if (!container) {
  throw new Error("Could not find root element");
}

const root = ReactDOM.createRoot(container);
root.render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  </React.StrictMode>
);
