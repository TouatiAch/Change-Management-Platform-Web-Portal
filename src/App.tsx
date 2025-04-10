import React from "react";
import { useMsal } from "@azure/msal-react";

function App() {
  const { instance } = useMsal();

  const handleLogin = () => {
    instance.loginRedirect();
  };

  return (
    <div style={{ padding: 50 }}>
      <h1>Change Management Portal</h1>
      <button onClick={handleLogin}>Login with Microsoft</button>
    </div>
  );
}

export default App;
