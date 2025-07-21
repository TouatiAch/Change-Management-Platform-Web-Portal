// File: ToolSelectionPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "react-multi-carousel/lib/styles.css";

import cmp3dLogo from "../assets/images/change_management_platform_full2.png";
import draxlLogo from "../assets/images/draxlmaier-group.png";

import harnessBg from "../assets/images/harness.png";

import settingsIc from "../assets/images/settings-icon.png";
import projectslogo from "../assets/images/projectsIcon.png"; 
import dataToolIcon from "../assets/images/dataToolIcon.png";
import dashBtn from "../assets/images/dashboard.png";
import kpiBtn from "../assets/images/kpis.png";

import { getAccessToken } from "../auth/getToken";
import { msalInstance } from "../auth/msalInstance";
import { db } from "./db";
import { CarImage } from "./types";
import Footer from "../components/Footer";
import mainBannerLogo from "../assets/images/drxhomepagelogo.png"; 

interface IProject {
  id: string;
  displayName: string;
  logo?: string;
  mapping: {
    implementation: string;
    feasibilityExtra?: string;
    implementationExtra?: string;
  };
}

interface cmConfigLists {
  siteId: string;
  questionsListId: string;
  monthlyListId: string;
  followCostListId: string;
  usersListId?: string;
  projects: IProject[];
}

const ToolSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [, setCars] = useState<CarImage[]>([]);
  const [, setProjects] = useState<IProject[]>([]);

  useEffect(() => {
    (async () => {
      const token = await getAccessToken(msalInstance, ["User.Read"]);
      if (token) {
        const res = await fetch("https://graph.microsoft.com/v1.0/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const profile = await res.json();
        setUserName(profile.displayName || "");
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const carImages = await db.carImages.toArray();
      setCars(carImages);

      const raw = localStorage.getItem("cmConfigLists");
      if (!raw) return;
      const config: cmConfigLists = JSON.parse(raw);
      setProjects(config.projects || []);
    })();
  }, []);

  return (
    <div
      className="relative flex flex-col min-h-screen bg-cover bg-center"
      style={{ backgroundImage: `url(${harnessBg})` }}
    >
      <div className="absolute inset-0 z-0" />

      {/* Header */}
<header className="relative z-10 w-full h-16 bg-white/80 backdrop-blur-md flex items-center justify-between px-6">
  {/* Left placeholder (if you want it to remain empty) */}
  <div className="w-1/3">
    {/* You can put a back button or leave it empty */}
  </div>

  {/* Center logo absolutely positioned */}
  <div className="absolute left-1/2 transform -translate-x-1/2">
    <img src={cmp3dLogo} alt="CMP" className="h-10" />
  </div>

  {/* Right logo */}
  <div className="w-1/3 flex justify-end">
    <img src={draxlLogo} alt="Dräxlmaier" className="h-8" />
  </div>
</header>

{/* Main Content */}
<main className="relative z-10 flex-1 flex flex-col items-center text-center px-4 pt-12 pb-14">
  <div className="cursor-pointer w-64 h-64 flex flex-col items-center justify-center space-y-2 p-6 mb-6 bg-white/20 backdrop-blur-sm rounded-2xl shadow-md hover:bg-white/30 transition">
  <img
    src={mainBannerLogo}
    alt="Main Banner"
    className="w-32 h-32 object-contain"
  />
</div>
<div>
  {userName && (
    <div className="flex items-center gap-4 mb-8 text-white bg-black/30 p-4 rounded-xl">
      <div className="text-lg font-semibold">Welcome, {userName}!</div>
    </div>)}
</div>
  {/* Updated Button Section */}
  <div className="flex flex-wrap justify-center items-start gap-6 mb-10">
  {[
    { img: projectslogo, label: "Projects", route: "/project-selection" },
    { img: dataToolIcon, label: "CMH Data Entry", route: "/data-extraction" },
    { img: kpiBtn, label: "KPIs Entry", route: "/kpis" },
    { img: dashBtn, label: "Dashboard", route: "/dashboard" },
    { img: settingsIc, label: "Settings", route: "/config" },
    { img: draxlLogo, label: "User Profile", route: "/user-profile" },
  ].map(({ img, label, route }) => (
    <button
      key={label}
      onClick={() => navigate(route)}
      className="group w-56 h-56 bg-white/20 backdrop-blur-md rounded-2xl shadow-lg hover:bg-white/30 hover:scale-105 transition transform duration-300 ease-in-out flex flex-col items-center justify-center text-white"
    >
      <img src={img} alt={label} className="h-24 w-24 mb-2 object-contain" />
      <span className="text-lg font-semibold text-center">{label}</span>
      <span className="mt-2 h-1 w-12 bg-yellow-400 scale-x-0 group-hover:scale-x-100 transition-transform origin-left rounded-full" />
    </button>
  ))}
</div>

  <div className="w-full">
</div>
</main>
<Footer />
    </div>
  );
};

export default ToolSelectionPage;
