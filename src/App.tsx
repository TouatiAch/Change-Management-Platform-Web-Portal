import React, { useState, useEffect } from "react";
import { useMsal, AuthenticatedTemplate, UnauthenticatedTemplate } from "@azure/msal-react";

function App() {
  const { instance } = useMsal();
  const [loggedOut, setLoggedOut] = useState(false);

  // Check for logout flag in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("logout") === "true") {
      setLoggedOut(true);
      // Remove the query parameter for a cleaner URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Login handler (unchanged)
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
      <h1>Change Management Portal</h1>

      {loggedOut && (
        <div style={{ color: "green", marginBottom: "20px" }}>
          You have successfully logged out.
        </div>
      )}

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
