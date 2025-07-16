// src/pages/ConfigPage.tsx
import React, { useState, FormEvent, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import harnessBg from "../assets/images/harness-bg.png";
import { db } from "./db"; // for Dexie usage
import { CarImage } from "./types";
import CarConfigurationComponent from "./CarConfigurationComponent";
import { AVAILABLE_PROJECTS } from "../constants/projects";
import { getConfig, saveConfig, IProject } from "../services/configService";
import TopMenu from "../components/TopMenu";
import { getProjectLogo } from "../utils/getProjectLogo";
import AreaImageUploadComponent from "../components/AreaImageUploadComponent";
import { lookupSiteAndLists } from "../services/siteLookupService";
import type { ListConfig } from "../services/configService";

function canonicalProjectId(input: string): string {
  let normalized = input.trim().toLowerCase().replace(/[\s_]+/g, '-');
  const aliasMap: Record<string, string> = {
    'mercedes': 'mercedes-benz',
    'merc': 'mercedes-benz',
    'mercedes-benz': 'mercedes-benz',
    'mercedesbenz': 'mercedes-benz',
    'vw': 'volkswagen'
  };
  return aliasMap[normalized] ?? normalized;
}

const ConfigPage: React.FC = () => {
  const navigate = useNavigate();
  const [siteName, setSiteName] = useState("");
  const [siteId, setSiteId] = useState<string | null>(null);
  const [lists, setLists] = useState<{ id: string; displayName: string }[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Frequent sites
  const [frequentSites, setFrequentSites] = useState<string[]>([]);
  // KPI Lists
  const [questionsListId, setQuestionsListId] = useState("");
  // KPI Lists
  const [downtimeListId, setDowntimeListId] = useState<string>("");
  const [drxListId, setDrxListId] = useState<string>("");
  const [budgetsListId, setBudgetsListId] = useState<string>("");
  const [followCostListId, setFollowCostListId] = useState<string>("");
  const [phase4TargetsListId, setPhase4TargetsListId] = useState<string>("");
  const [configLists, setConfigLists] = useState<ListConfig[]>([]);

  // Projects
  const [projects, setProjects] = useState<IProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  // Roles
  // Dexie-based car images
  const [carList, setCarList] = useState<CarImage[]>([]);
  // Track which tab is active: "lists", "cars", or "roles"
const [activeTab, setActiveTab] = useState<"lists" | "cars" | "roles" | "areaImages">("lists");
  const [editCarId, setEditCarId] = useState<number | null>(null);
const [editCarName, setEditCarName] = useState("");

  const handleDeleteCar = async (carId: number) => {
  await db.carImages.delete(carId);
  loadCarList(); // refresh
};

const handleEditCar = (car: CarImage) => {
  setEditCarId(car.id || null);
  setEditCarName(car.name || "");
};

const handleSaveCarName = async () => {
  if (!editCarId) return;
  await db.carImages.update(editCarId, { name: editCarName });
  setEditCarId(null);
  setEditCarName("");
  loadCarList(); // refresh
};
  // 1) Load config from localStorage on mount, plus load Dexie cars
 useEffect(() => {
  const savedSite = localStorage.getItem("sharepointSite");
  if (savedSite) setSiteName(savedSite);

  try {
    const cfg = getConfig();
    setSiteId(cfg.siteId || null);
    setQuestionsListId(cfg.questionsListId || "");
    setProjects((cfg.projects || []).map(p => ({ ...p, logo: p.logo || getProjectLogo(p.id) })));
    setFrequentSites(cfg.frequentSites || []);
    setConfigLists(cfg.lists || []);
  } catch (err) {
    console.error("Failed to load config:", err);
  }

  loadCarList();
}, []);

  const loadCarList = async () => {
    const allCars = await db.carImages.toArray();
    setCarList(allCars);
  };
  // 2) Site lookup
   const handleSiteLookup = async (e: FormEvent) => {
    e.preventDefault();
    setLoadingLists(true);
    setMessage(null);

    try {
      const { config: newCfg, projects: newProjects, fetchedLists } = await lookupSiteAndLists(
        siteName,
        projects,
        frequentSites
      );

      setSiteId(newCfg.siteId);
      setQuestionsListId(newCfg.questionsListId);
      setProjects(newProjects);
      setLists(fetchedLists);  
      setFrequentSites(newCfg.frequentSites || []);
      setConfigLists(newCfg.lists);
      newCfg.lists.forEach(l => {
  switch (l.name) {
    case "downtime":
      setDowntimeListId(l.listId);
      break;
    case "DRX":
      setDrxListId(l.listId);
      break;
    case "Budgets":
      setBudgetsListId(l.listId);
      break;
    case "FollowCostKPI":
      setFollowCostListId(l.listId);
      break;
    case "Phase4Targets":
      setPhase4TargetsListId(l.listId);
      break;
  }
});

      setMessage("✅ Site & KPI lists detected and saved!");
    } catch (err: any) {
      setMessage(err.message || "Lookup failed");
    } finally {
      setLoadingLists(false);
    }
  }; 
  
  // 4) Projects
  const addProjectFromDropdown = () => {
  if (!selectedProjectId) {
    setMessage("Please select a project from the dropdown.");
    return;
  }
  // Normalize the selected project ID
  const canonicalId = canonicalProjectId(selectedProjectId);

  // Check if the project already exists (use canonical ID on both sides)
  const existing = projects.find((p) => canonicalProjectId(p.id) === canonicalId);
  if (existing) {
    setMessage(`Project '${existing.displayName}' is already added.`);
    return;
  }

  // Find the project in AVAILABLE_PROJECTS by canonical ID
  const chosen = AVAILABLE_PROJECTS.find((p) => canonicalProjectId(p.id) === canonicalId);
  if (!chosen) {
    setMessage("Selected project not found in AVAILABLE_PROJECTS.");
    return;
  }

  // Use the canonical ID for the new project
  const newProject: IProject = {
    id: chosen.id, // chosen.id should already be canonical
    displayName: chosen.displayName,
    logo: chosen.logo,
    mapping: {
      implementation: "",
      feasibilityExtra: "",
      implementationExtra: "",
      changeQuestionStatusListId: ""
    },
  };

  setProjects((prev) => [...prev, newProject]);
  setSelectedProjectId("");
  setMessage(null);
};

  const removeProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };
  const handleProjectMappingChange = (
    projId: string,
    field: keyof IProject["mapping"],
    value: string
  ) => {
    setProjects((prev) =>
      prev.map((proj) =>
        proj.id === projId
          ? {
              ...proj,
              mapping: { ...proj.mapping, [field]: value },
            }
          : proj
      )
    );
  };

  const handleSave = () => {
    if (!questionsListId) {
      setMessage("Please select your Questions list.");
      return;
    }
    for (const proj of projects) {
      if (!proj.mapping.implementation && !proj.mapping.implementationExtra) {
        setMessage(`Project "${proj.displayName}" needs a list mapping.`);
        return;
      }
    }
    const cfg = getConfig();
    cfg.questionsListId = questionsListId;
    cfg.projects = projects;
    cfg.frequentSites = frequentSites;
    saveConfig(cfg);

    setMessage("✅ Questions & Project mappings saved!");
  };

  return (
    <div
      className="relative w-full min-h-screen bg-cover bg-center"
      style={{ backgroundImage: `url(${harnessBg})` }}
    >
      <div className="absolute inset-0 bg-opacity-50" />
      <TopMenu />
      <button
        onClick={() => navigate("/tool-selection")}
        className="absolute top-4 left-4 z-20 px-3 py-2 bg-white/30 rounded text-white hover:bg-white/50 transition"
      >
        ← Back
      </button>

      <div className="relative z-10 flex mx-auto max-w-6xl bg-white/20 backdrop-blur-lg rounded-lg overflow-hidden">
        {/* Sidebar Tabs */}
        <aside className="w-1/4 bg-white/30 p-6 space-y-4">
          <button
            onClick={() => setActiveTab("lists")}
            className={`w-full py-3 rounded-xl text-center font-medium transition ${
              activeTab === "lists" ? "bg-[#1cb3d2] text-white" : "text-white hover:bg-white/30"
            }`}
          >
            Configure Lists
          </button>
          <button
            onClick={() => setActiveTab("cars")}
            className={`w-full py-3 rounded-xl text-center font-medium transition ${
              activeTab === "cars" ? "bg-[#1cb3d2] text-white" : "text-white hover:bg-white/30"
            }`}
          >
            Configure Cars
          </button>
          <button
            onClick={() => setActiveTab("areaImages")}
            className={`w-full py-3 rounded-xl text-center font-medium transition ${
              activeTab === "areaImages" ? "bg-[#1cb3d2] text-white" : "text-white hover:bg-white/30"
            }`}
          >
            Configure Area Images
          </button>
        </aside>

        <main className="flex-1 p-8 space-y-6 text-white">
{/* TAB: lists */}
{activeTab === "lists" && (
  <>
    <h2 className="text-2xl font-semibold">List Configuration</h2>

    {/* 1) Site Lookup */}
    <form onSubmit={handleSiteLookup} className="space-y-4">
      <label className="block">
        <span className="text-lg">SharePoint Site Name</span>
        <input
          type="text"
          value={siteName}
          onChange={e => setSiteName(e.target.value)}
          required
          className="w-full mt-1 p-2 rounded bg-white/80 text-gray-900"
        />
      </label>
      <label className="block">
        Frequently Used Sites
        <select
          onChange={e => setSiteName(e.target.value)}
          className="w-full mt-1 p-2 rounded bg-white/80 text-gray-900"
        >
          <option value="">-- Select a Site --</option>
          {frequentSites.map((s,i) => (
            <option key={i} value={s}>{s}</option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={loadingLists}
        className="px-6 py-2 bg-[#1cb3d2] rounded-xl font-medium hover:opacity-90"
      >
        {loadingLists ? "Loading…" : "Lookup Lists"}
      </button>
    </form>

    {/* 2) Once you’ve fetched, show each KPI‐list dropdown */}
    {lists.length > 0 && (
      <div className="space-y-6 mt-6">

        {/** Downtime */}
        <div>
          <label className="block">
            Downtime List
            <select
              value={downtimeListId}
              onChange={e => setDowntimeListId(e.target.value)}
              className="w-full mt-1 p-2 rounded bg-white/80 text-gray-900"
            >
              <option value="">-- Select Downtime --</option>
              {lists.map(l => (
                <option key={l.id} value={l.id}>{l.displayName}</option>
              ))}
            </select>
          </label>
        </div>

        {/** DRX */}
        <div>
          <label className="block">
            DRX Ideas List
            <select
              value={drxListId}
              onChange={e => setDrxListId(e.target.value)}
              className="w-full mt-1 p-2 rounded bg-white/80 text-gray-900"
            >
              <option value="">-- Select DRX --</option>
              {lists.map(l => (
                <option key={l.id} value={l.id}>{l.displayName}</option>
              ))}
            </select>
          </label>
        </div>

        {/** Budgets */}
        <div>
          <label className="block">
            Budgets List
            <select
              value={budgetsListId}
              onChange={e => setBudgetsListId(e.target.value)}
              className="w-full mt-1 p-2 rounded bg-white/80 text-gray-900"
            >
              <option value="">-- Select Budgets --</option>
              {lists.map(l => (
                <option key={l.id} value={l.id}>{l.displayName}</option>
              ))}
            </select>
          </label>
        </div>

        {/** FollowCostKPI */}
        <div>
          <label className="block">
            Follow-up Cost List
            <select
              value={followCostListId}
              onChange={e => setFollowCostListId(e.target.value)}
              className="w-full mt-1 p-2 rounded bg-white/80 text-gray-900"
            >
              <option value="">-- Select FollowCostKPI --</option>
              {lists.map(l => (
                <option key={l.id} value={l.id}>{l.displayName}</option>
              ))}
            </select>
          </label>
        </div>

        {/** Phase4Targets */}
        <div>
          <label className="block">
            Phase 4 Targets List
            <select
              value={phase4TargetsListId}
              onChange={e => setPhase4TargetsListId(e.target.value)}
              className="w-full mt-1 p-2 rounded bg-white/80 text-gray-900"
            >
              <option value="">-- Select Phase4Targets --</option>
              {lists.map(l => (
                <option key={l.id} value={l.id}>{l.displayName}</option>
              ))}
            </select>
          </label>
        </div>

        {/* 3) Projects mapping */}
        <div>
          <h3 className="text-xl font-medium">Projects</h3>

          {/* Add New Project */}
          <div className="flex items-center gap-3 mb-4">
            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="p-2 rounded bg-white/80 text-gray-900 flex-1"
            >
              <option value="">-- Choose a Project --</option>
              {AVAILABLE_PROJECTS.map(p => (
                <option key={p.id} value={p.id}>{p.displayName}</option>
              ))}
            </select>
            <button
              onClick={addProjectFromDropdown}
              className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800"
            >
              + Add
            </button>
          </div>

          {/* Each Project’s two mappings */}
          {/* Each Project’s two mappings */}
{projects.map(proj => (
  <div key={proj.id} className="mt-4 bg-white/10 p-4 rounded space-y-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {proj.logo && (
          <img
            src={proj.logo}
            alt={proj.displayName}
            className="w-8 h-8 object-contain"
          />
        )}
        <span className="font-semibold">{proj.displayName}</span>
      </div>
      <button
        onClick={() => removeProject(proj.id)}
        className="px-2 py-1 bg-red-600 text-white rounded"
      >
        Remove
      </button>
    </div>

    {/* Changes list */}
    <label className="block">
      Changes List
      <select
        value={proj.mapping.implementation}
        onChange={e =>
          handleProjectMappingChange(
            proj.id,
            "implementation",
            e.target.value
          )
        }
        className="w-full mt-1 p-2 rounded bg-white/80 text-gray-900"
      >
        <option value="">-- Select Changes List --</option>
        {lists.map(l => (
          <option key={l.id} value={l.id}>{l.displayName}</option>
        ))}
      </select>
    </label>

    {/* ChangeQuestionStatus list */}
    <label className="block">
      ChangeQuestionStatus List
      <select
        value={proj.mapping.changeQuestionStatusListId || ""}
        onChange={e =>
          handleProjectMappingChange(
            proj.id,
            "changeQuestionStatusListId",
            e.target.value
          )
        }
        className="w-full mt-1 p-2 rounded bg-white/80 text-gray-900"
      >
        <option value="">-- Select Status List --</option>
        {lists.map(l => (
          <option key={l.id} value={l.id}>{l.displayName}</option>
        ))}
      </select>
    </label>
  </div>
))}

          {/* ONLY ONE Save button */}
          <button
            onClick={handleSave}
            className="mt-6 px-6 py-2 bg-[#1cb3d2] rounded-xl font-medium hover:opacity-90"
          >
            Save Configuration
          </button>
        </div>
      </div>
    )}
  </>
)}

          {/* TAB: cars */}
          {activeTab === "cars" && (
  <>
    {/* Car Upload and Configuration */}
    <CarConfigurationComponent projects={projects} siteId={siteId} />

    {/* Manage Existing Cars section is here */}
    <div className="space-y-6">
      <hr className="my-6 border-gray-600" />

      <h2 className="text-2xl font-semibold">Manage Existing Cars</h2>
      {carList.length === 0 ? (
        <p>No car images saved yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {carList.map((car) => (
            <div key={car.id} className="bg-white/20 p-4 rounded space-y-3">
              {/* Project */}
              <div className="flex justify-between items-center">
                {projects
                  .filter((p) => p.id === car.projectId)
                  .map((proj) => (
                    <div key={proj.id} className="flex items-center gap-2">
                      {proj.logo && (
                        <img
                          src={proj.logo}
                          alt={proj.displayName}
                          className="w-8 h-8 object-contain"
                        />
                      )}
                      <span>{proj.displayName}</span>
                    </div>
                  ))}

                <button
                  onClick={() => handleDeleteCar(car.id!)}
                  className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
              {/* Car image */}
              <img
                src={car.data}
                alt={car.name || "Car"}
                className="w-full h-32 object-contain bg-white/10 rounded"
              />

              {/* Edit/display car name */}
              {editCarId === car.id ? (
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={editCarName}
                    onChange={(e) => setEditCarName(e.target.value)}
                    className="flex-1 p-2 rounded bg-white/80 text-gray-900"
                  />
                  <button
                    onClick={handleSaveCarName}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="font-medium">{car.name || ""}</p>
                  <button
                    onClick={() => handleEditCar(car)}
                    className="text-sm text-blue-300 hover:underline"
                  >
                    Edit
                  </button>
                </div>
              )}
              {/* Carline */}
              {car.carline && (
                <p className="text-sm bg-white/10 p-2 rounded">
                  Carline: {car.carline}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  </>
)}
          {activeTab === "areaImages" && (
  <AreaImageUploadComponent projects={projects} />
)}
          {message && <p className="mt-4 text-yellow-200">{message}</p>}
        </main>
      </div>
    </div>
  );
};

export default ConfigPage;
