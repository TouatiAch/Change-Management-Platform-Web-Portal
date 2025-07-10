// File: src/pages/DowntimeKPIInput.tsx

import React from "react";
import { useNavigate } from "react-router-dom";
import KPIInputWrapper from "../../pages/shared/KPIInputWrapper";

const DowntimeKPIInput: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div>
      {/* Top Navigation Buttons */}
      <div className="relative z-20 max-w-6xl mx-auto p-4 flex items-center space-x-4 mb-4">
        {/* Back Button */}
        <button
          onClick={() => navigate("/tool-selection")}
          className="flex items-center space-x-2
                     px-3 py-2 bg-white/20 hover:bg-white/30 backdrop-blur
                     rounded-2xl shadow-md text-white text-sm transition"
        >
          ← Back
        </button>

        {/* Downtime KPI Editor Button */}
        <button
          onClick={() => navigate("/kpi-editor/downtime")}
          className="flex items-center space-x-2
                     px-3 py-2 bg-blue-600 hover:bg-blue-500 backdrop-blur
                     rounded-2xl shadow-md text-white text-sm transition"
        >
          🛠️ Open Downtime KPI Editor
        </button>
      </div>

      {/* KPI Input Section */}
      <KPIInputWrapper
        title=" Downtime "
        fields={[
          { label: "Downtime (minutes)", key: "downtime" },
          { label: "Production Minutes", key: "productionminutes" },
          { label: "Target Downtime", key: "Targetdowntime" },
          { label: "Seuil d'intervention Downtime", key: "seuildinterventiondowntime" },
        ]}
      />
    </div>
  );
};

export default DowntimeKPIInput;
