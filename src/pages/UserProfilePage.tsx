// src/pages/UserProfilePage.tsx

import React, { useEffect, useState } from "react";
import { getAccessToken } from "../auth/getToken";
import { msalInstance } from "../auth/msalInstance";

interface UserProfile {
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  companyName?: string;
  givenName?: string;
  surname?: string;
  mobilePhone?: string;
  businessPhones?: string[];
  preferredLanguage?: string;
  id?: string;
}

export default function UserProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken(msalInstance, [
          "User.Read",
          "User.ReadBasic.All",
        ]);
        if (!token) throw new Error("No token");

        const res = await fetch("https://graph.microsoft.com/v1.0/me", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });
        const data = await res.json();
        setProfile(data);
      } catch (err) {
        console.error("Failed to fetch user profile", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

 if (loading) return <div className="user-profile-page">Loading user profile...</div>;
if (!profile) return <div className="user-profile-page">Failed to load user profile.</div>;

return (
  <div className="user-profile-page">
    <h2 className="title">Raw Microsoft 365 Graph Response</h2>
    <pre className="bg-gray-100 p-4 rounded-md overflow-x-auto text-sm">
      {JSON.stringify(profile, null, 2)}
    </pre>
  </div>
);
};
