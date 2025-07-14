// src/pages/Phase4KPIInput.tsx

import React from "react";
import { useNavigate } from "react-router-dom";
import { getConfig } from "../../services/configService";
import Phase4ClosureDashboard from "../dashboard/phase 4 closure/Phase4ClosureDashboard";
import { getAccessToken } from "../../auth/getToken";
import { msalInstance } from "../../auth/msalInstance";

const Phase4KPIInput: React.FC = () => {
  const navigate = useNavigate();
  const config = getConfig();

  // 1️⃣ pull the right list config
  const phase4Cfg = config.lists.find((l) => l.name === "Phase4Targets");
  if (!phase4Cfg) {
    return (
      <div className="p-6 text-red-400">
        Error: “Phase4Targets” not configured in app settings.
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-screen bg-cover bg-center text-white">
      {/* Top Navigation Buttons */}
      <div className="relative z-20 max-w-6xl mx-auto p-4 flex items-center space-x-4 mb-4">
        <button
          onClick={() => navigate("/tool-selection")}
          className="flex items-center space-x-2 px-3 py-2 bg-white/20 hover:bg-white/30 backdrop-blur rounded-2xl shadow-md text-white text-sm transition"
        >
          ← Back
        </button>
      </div>

      {/* Main card */}
      <div className="relative z-10 max-w-5xl mx-auto mt-6 p-6 bg-white/10 border border-white/20 backdrop-blur-md rounded-xl shadow-xl">
        <h2 className="text-3xl font-semibold mb-6 text-white/90">
          Phase 4 KPI Input
        </h2>

        <Phase4ClosureDashboard
          projects={config.projects}
          changeItems={[]}                     // no preloading needed
          phase4TargetsListId={phase4Cfg.listId}
          siteId={config.siteId}
          getToken={async () => {
            const tok = await getAccessToken(
              msalInstance,
              ["Sites.Manage.All"]
            );
            if (!tok) throw new Error("No Graph token");
            return tok;
          }}
        />
      </div>
    </div>
  );
};

export default Phase4KPIInput;
