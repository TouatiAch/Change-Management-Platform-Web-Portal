// src/authConfig.ts

export const msalConfig = {
  auth: {
    //app registration for draxlameir
    clientId: "0681f782-b93e-4816-abc1-04db7c272689",
   authority: "https://login.microsoftonline.com/492ac175-0fcd-4d6c-8fde-e15c70d1986b", 
//app registration for uit
    //clientId: "17d45425-fdd2-42ea-aa96-37a92dc49794",
    //authority: "https://login.microsoftonline.com/e030b0c2-7438-480c-8b0c-0d7c3ae5f098", 
    redirectUri: "https://touatiach.github.io/Change-Management-Platform-Web-Portal/",
    //redirectUri: "http://localhost:3000",
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
    "https://graph.microsoft.com/Mail.Read",
    "https://graph.microsoft.com/Mail.ReadWrite",
    "https://graph.microsoft.com/Mail.Send",
    "https://graph.microsoft.com/Mail.Send.Shared",
    //"https://graph.microsoft.com/MailboxFolder.Read",
    //"https://graph.microsoft.com/MailboxFolder.ReadWrite",
    //"https://graph.microsoft.com/MailboxItem.Read",
    "https://graph.microsoft.com/User.Read",
    "https://graph.microsoft.com/User.ReadBasic.All",
    "https://graph.microsoft.com/offline_access",
    "https://graph.microsoft.com/Sites.Read.All",
    "https://graph.microsoft.com/Sites.ReadWrite.All",
    "https://graph.microsoft.com/Sites.Manage.All"
  ],
};
