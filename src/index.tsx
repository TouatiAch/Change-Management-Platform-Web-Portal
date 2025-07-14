// src/index.tsx
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";

import App from "./App";
import { msalConfig } from "./authConfig";
import "./index.css";
// GA4 imports
import { initGA } from "./analytics/ga4";
import { RouterTracker } from "./analytics/RouterTracker";
import { reportWebVitals } from "./analytics/vitals";

const msalInstance = new PublicClientApplication(msalConfig);

const RootRouter: React.FC = () => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // initialize GA as early as possible
    initGA();

    msalInstance
      .initialize()
      .then(() => msalInstance.handleRedirectPromise())
      .then((resp) => {
        if (resp?.account) {
          msalInstance.setActiveAccount(resp.account);
        }
      })
      .catch((e) => console.error("MSAL redirect error:", e))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return <div>Loading authentication...</div>;
  }

  return <App />;
};

const Root: React.FC = () => (
  <HashRouter>
    {/* Tracker will send a page_view on every hash change */}
    <RouterTracker />
    <MsalProvider instance={msalInstance}>
      <RootRouter />
    </MsalProvider>
  </HashRouter>
);

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(<Root />);

// after the app is up, start collecting Web Vitals
reportWebVitals();
