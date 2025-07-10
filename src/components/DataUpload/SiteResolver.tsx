// File: src/components/SiteResolver.tsx

import React, { useState } from "react";
import { getAccessToken } from "../../auth/getToken";
import { msalInstance } from "../../auth/msalInstance";
import { resolveSiteIdFromUrl } from "../../services/sharepointService";


interface Props {
  onResolved: (siteId: string, siteUrl: string) => void;
  onLog: (message: string) => void;
}

const scopes = ["Sites.ReadWrite.All", "Sites.Manage.All"];

const SiteResolver: React.FC<Props> = ({ onResolved, onLog }) => {
  const [siteUrl, setSiteUrl] = useState<string>(localStorage.getItem("sharepointSite") || "");
  const [resolving, setResolving] = useState<boolean>(false);

  const handleResolve = async () => {
    try {
      setResolving(true);
      const token = await getAccessToken(msalInstance, scopes);
      if (!token) throw new Error("Token not available");

      const { siteId } = await resolveSiteIdFromUrl(siteUrl, token);
      if (!siteId) throw new Error("Could not resolve Site ID.");

      // Persist values
      localStorage.setItem("sharepointSite", siteUrl);
      localStorage.setItem("sharepointSiteId", siteId);

      onResolved(siteId, siteUrl);
      onLog(`✅ SharePoint site resolved: ${siteId}`);
    } catch (err: any) {
      console.error("Site resolution failed:", err);
      onLog(`❌ Site resolution failed: ${err.message}`);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="site-resolver space-y-3">
      <label className="block font-medium text-sm mb-1">SharePoint Site URL:</label>
      <input
        type="text"
        value={siteUrl}
        onChange={(e) => setSiteUrl(e.target.value)}
        placeholder="https://company.sharepoint.com/sites/YourSite"
        className="w-full p-2 rounded bg-white text-black"
      />
      <button
        onClick={handleResolve}
        disabled={resolving}
        className="px-4 py-2 bg-[#00f0cc] text-black font-semibold rounded hover:opacity-90 transition"
      >
        {resolving ? "Resolving..." : "Resolve Site"}
      </button>
    </div>
  );
};

export default SiteResolver;
