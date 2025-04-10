// src/App.tsx
import React, { useState, useEffect } from "react";
import { useMsal, AuthenticatedTemplate, UnauthenticatedTemplate } from "@azure/msal-react";

function App() {
  const { instance } = useMsal();
  const [loggedOut, setLoggedOut] = useState(false);

  // Log to ensure App component is mounting
  console.log("App is rendering", instance);

  // Check URL for logout flag
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("logout") === "true") {
      setLoggedOut(true);
      // Clean URL by removing the query parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Handlers
  const handleLogin = () => {
    instance.loginRedirect();
  };

  const handleLogout = () => {
    instance.logoutRedirect({
      postLogoutRedirectUri: `${process.env.REACT_APP_REDIRECT_URI}?logout=true`,
    });
  };

  return (
    <div style={{ padding: "50px", textAlign: "center" }}>
      {/* Debug message to confirm rendering */}
      <div style={{ background: "#eee", padding: "10px", marginBottom: "20px" }}>
        App is rendering!
      </div>

      <h1>Change Management Portal</h1>

      {loggedOut && (
        <div style={{ color: "green", marginBottom: "20px" }}>
          You have successfully logged out.
        </div>
      )}

      {/* These components conditionally render based on authentication state */}
      <AuthenticatedTemplate>
        <p>You are logged in!</p>
        <button onClick={handleLogout}>Logout</button>
      </AuthenticatedTemplate>

      <UnauthenticatedTemplate>
        <p>You are not logged in!</p>
        <button onClick={handleLogin}>Login with Microsoft</button>
      </UnauthenticatedTemplate>
    </div>
  );
}

export default App;
