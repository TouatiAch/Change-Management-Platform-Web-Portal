// src/authConfig.ts
export const msalConfig = {
  auth: {
    clientId: "17d45425-fdd2-42ea-aa96-37a92dc49794", // Replace with your Azure app client ID
    authority: "https://login.microsoftonline.com/e030b0c2-7438-480c-8b0c-0d7c3ae5f098", // or your specific tenant ID if needed
    redirectUri: process.env.REACT_APP_REDIRECT_URI,
  },
  cache: {
    cacheLocation: "sessionStorage", // Recommended: sessionStorage or localStorage (depending on your needs)
    storeAuthStateInCookie: false, // Set to true if you encounter issues on IE11 or Edge
  },
};
