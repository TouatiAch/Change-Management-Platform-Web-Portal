import React from "react";
import { getConfig } from "../../services/configService";
import { getAccessToken } from "../../auth/getToken";
import { msalInstance } from "../../auth/msalInstance";
import KpiListManager from "./KpiListManager";

export default function BudgetsListManager() {
  const cfg = getConfig();
  const listCfg = cfg.lists.find(l => l.name === "Budgets");
  if (!listCfg) return <p className="text-red-400">Budgets list not configured.</p>;

  return (
    <KpiListManager
      siteId={cfg.siteId}
      listConfig={listCfg}
      projects={cfg.projects}
      getToken={async () => {
        const token = await getAccessToken(msalInstance, ["Sites.Manage.All"]);
        if (!token) throw new Error("Could not get Graph token");
        return token;
      }}
    />
  );
}
