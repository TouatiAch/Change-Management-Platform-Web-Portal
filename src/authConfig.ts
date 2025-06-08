// src/authConfig.ts

export const msalConfig = {
  auth: {
    clientId: "17d45425-fdd2-42ea-aa96-37a92dc49794",
    authority:
      "https://login.microsoftonline.com/e030b0c2-7438-480c-8b0c-0d7c3ae5f098",
    redirectUri: "http://localhost:3000",
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

// Define your token‐request parameters here:

// Graph API requests (SharePoint + Mail.Send)
export const graphTokenRequest = {
  scopes: [
    "https://graph.microsoft.com/Sites.Read.All",
    "https://graph.microsoft.com/Sites.ReadWrite.All",
    "https://graph.microsoft.com/Mail.Send",
  ],
};


