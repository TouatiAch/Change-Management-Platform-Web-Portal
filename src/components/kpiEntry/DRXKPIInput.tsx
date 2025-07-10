import React from "react";
import { useNavigate } from "react-router-dom";
import KPIInputWrapper from "../../pages/shared/KPIInputWrapper";

const DRXKPIInput: React.FC = () => {
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

        {/* DRX KPI Editor Button */}
        <button
          onClick={() => navigate("/kpi-editor/drx")}
          className="flex items-center space-x-2
                     px-3 py-2 bg-blue-600 hover:bg-blue-500 backdrop-blur
                     rounded-2xl shadow-md text-white text-sm transition"
        >
          📊 Open DRX KPI Editor
        </button>
      </div>

      {/* KPI Input Section */}
      <KPIInputWrapper
        title="Engineering DRX Ideas "
        fields={[
          { label: "DRX Idea submitted Idea", key: "DRXIdeasubmittedIdea" },
          { label: "DRX Idea submitted Idea Goal", key: "DRXIdeasubmittedIdeaGoal" },
        ]}
        fixedProject="draxlmaeir"    // <-- Add this line!
      />
    </div>
  );
};

export default DRXKPIInput;
