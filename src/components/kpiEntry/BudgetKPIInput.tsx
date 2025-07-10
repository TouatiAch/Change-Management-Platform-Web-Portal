// File: src/pages/BudgetKPIInput.tsx

import React from "react";
import { useNavigate } from "react-router-dom";
import BudgetInputWrapper from "./BudgetInputWrapper";

const BudgetKPIInput: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div>
      {/* Top Navigation Buttons */}
      <div className="relative z-20 max-w-6xl mx-auto p-4 flex items-center space-x-4 mb-4">
        <button
          onClick={() => navigate("/tool-selection")}
          className="flex items-center space-x-2 px-3 py-2 bg-white/20 hover:bg-white/30 backdrop-blur rounded-2xl shadow-md text-white text-sm transition"
        >
          ← Back
        </button>
        <button
          onClick={() => navigate("/kpi-editor/budget")}
          className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 backdrop-blur rounded-2xl shadow-md text-white text-sm transition"
        >
          💰 Open Budget KPI Editor
        </button>
      </div>

      {/* Budget KPI Input Section */}
      <BudgetInputWrapper />
    </div>
  );
};

export default BudgetKPIInput;
