import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import cmp3dLogo from "../assets/images/change_management_platform_full2.png";
import draxlLogo from "../assets/images/draxlmaier-group.png";
import cmpIcon from "../assets/images/cmpIcon.png";
import dataToolIcon from "../assets/images/dataToolIcon.png";
import harnessBg from "../assets/images/harness.png"; // ensure this import matches the real path
import { getAccessToken } from "../auth/getToken";
import { msalInstance } from "../auth/msalInstance";

const ToolSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  
  // Fetch user display name from Microsoft Graph (if desired)
    useEffect(() => {
      (async () => {
        try {
          const token = await getAccessToken(msalInstance,["User.Read"]);
          if (!token) return;
          const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const profile = await profileRes.json();
          setUserName(profile.displayName || "");
        } catch (err) {
          console.error("Error loading user data", err);
        }
      })();
    }, []);
  return (
    <div
      className="relative flex flex-col min-h-screen bg-cover bg-center"
      style={{ backgroundImage: `url(${harnessBg})` }}
    >
      {/* Overlay for better contrast */}
      <div className="absolute inset-0 backdrop-blur-sm z-0" />

      {/* Header */}
      <header className="relative z-10 w-full h-16 bg-white/80 backdrop-blur-md flex items-center justify-between px-6">
        <div>

        </div>
        <img src={cmp3dLogo} alt="CMP" className="h-10" />
        <img src={draxlLogo} alt="Dräxlmaier" className="h-8" />
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-white text-center px-4">
        {userName && (
          <div className="flex items-center gap-4 mb-6 text-white bg-black/30 p-4 rounded-xl">
            <div className="text-lg font-semibold">Welcome, {userName}! Choose a task to continue</div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-10">
          {[
            { img: cmpIcon, label: "Data Management", route: "/landing" },
            { img: dataToolIcon, label: "Data Extraction", route: "/data-extraction" },
          ].map(({ img, label, route }) => (
            <button
              key={label}
              onClick={() => navigate(route)}
              className="
                w-72 h-72 
                bg-white/20 backdrop-blur-md 
                rounded-2xl shadow-lg
                hover:bg-white/30 hover:scale-105 
                transition transform duration-300 ease-in-out
                flex flex-col items-center justify-center text-white
              "
            >
              <img src={img} alt={label} className="h-48 w-38 mb-6 object-contain" />
              <span className="text-xl font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
};

export default ToolSelectionPage;
