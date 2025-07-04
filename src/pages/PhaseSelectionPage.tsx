import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import harnessBg from "../assets/images/harness-bg.png";
import implementationBtn from "../assets/images/implementation.png";
import feasibilityBtn from "../assets/images/feasability2.png";
import { updateProjectMappingsFromSites } from "./projectMapping";
import { PROJECT_LOGO_MAP } from "../constants/projects";
import { IProject } from "../services/configService";
import { getAccessToken } from "../auth/getToken";
import { msalInstance } from "../auth/msalInstance";
import TopMenu from "../components/TopMenu";

const LISTS_CONFIG_KEY = "cmConfigLists";

const PhaseSelectionPage: React.FC = () => {
  const [project, setProject] = useState<IProject | null>(null);
  const [loading, setLoading] = useState(true);
  const { projectKey } = useParams<{ projectKey: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const refreshAndLoad = async () => {
      try {
        // Acquire token before making API calls
        const token = await getAccessToken(msalInstance, ["https://graph.microsoft.com/Sites.Read.All"]);
        if (!token) {
          console.warn("Access token unavailable — user not authenticated?");
          return;
        }

        await updateProjectMappingsFromSites(token);

        const raw = localStorage.getItem(LISTS_CONFIG_KEY);
        if (raw) {
          const config = JSON.parse(raw);
          if (Array.isArray(config.projects)) {
            const found = config.projects.find(
              (p: IProject) => p.id === projectKey
            );
            if (found) {
              const patched = {
                ...found,
                logo: PROJECT_LOGO_MAP[found.id.toLowerCase()] || PROJECT_LOGO_MAP["other"],
              };
              setProject(patched);
            }
          }
        }
      } catch (err) {
        console.error("Error loading project mappings:", err);
      } finally {
        setLoading(false);
      }
    };

    if (projectKey) {
      refreshAndLoad();
    }
  }, [projectKey]);

  if (loading) {
    return (
      <div
        className="relative w-full min-h-screen bg-cover bg-center flex flex-col items-center justify-center text-white"
        style={{ backgroundImage: `url(${harnessBg})` }}
      >
        <p className="text-lg">Loading phase selection...</p>
      </div>
    );
  }

  if (!projectKey || !project) {
    return (
      <div
        className="relative w-full min-h-screen bg-cover bg-center flex flex-col items-center justify-center text-white"
        style={{ backgroundImage: `url(${harnessBg})` }}
      >
        <TopMenu />
        <button
          onClick={() => navigate("/project-selection")}
           className="absolute top-4 left-4 z-20 flex items-center space-x-2 px-3 py-2 bg-white/20 hover:bg-white/30 backdrop-blur rounded-2xl shadow-md text-white text-sm transition"
      >
          ← Back
        </button>
        <p className="text-2xl mt-6">
          Unable to find that project. Please select a valid project.
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative w-full min-h-screen bg-cover bg-center"
      style={{ backgroundImage: `url(${harnessBg})` }}
    >
      {/* back button */}
      <div className="p-4">
  <button
    onClick={() => navigate("/project-selection")}
    className="flex items-center space-x-2 px-3 py-2 bg-white/20 hover:bg-white/30 backdrop-blur rounded-2xl shadow-md text-white text-sm transition"
  >
    ← Back to Projects
  </button>
</div>


      {/* content */}
      <div className="flex flex-col items-center justify-center text-center space-y-10 px-4">
        {project.logo && (
          <img
            src={project.logo}
            alt={`${project.displayName} logo`}
            className="h-24 sm:h-32 mt-8 object-contain"
          />
        )}

        <h1 className="text-3xl sm:text-4xl font-bold text-white mt-4">
          Choose Phase for <span className="uppercase">{project.displayName}</span>
        </h1>

  <div className="flex flex-col sm:flex-row gap-6 items-center">
  {project.mapping.implementation && (
    <div
      onClick={() => navigate(`/changes/${project.id}/feasibility`)}
      className="group flex flex-col items-center justify-center
        w-56 sm:w-80 p-10
        bg-white/20 backdrop-blur-md
        rounded-2xl shadow-lg
        cursor-pointer
        hover:bg-white/30 hover:scale-105
        transition transform duration-300 ease-in-out
      "
    >
      <img src={feasibilityBtn} alt="Feasibility" className="h-24 sm:h-32 mb-4 object-contain" />
      <span className="text-white text-lg font-semibold">Feasibility</span>
      <span className="mt-2 h-1 w-12 bg-yellow-400 scale-x-0 group-hover:scale-x-100 transition-transform origin-left rounded-full" />
    </div>
  )}

  {project.mapping.implementation && (
    <div
      onClick={() => navigate(`/changes/${project.id}/implementation`)}
      className="group flex flex-col items-center justify-center
        w-56 sm:w-80 p-10
        bg-white/20 backdrop-blur-md
        rounded-2xl shadow-lg
        cursor-pointer
        hover:bg-white/30 hover:scale-105
        transition transform duration-300 ease-in-out
      "
    >
      <img src={implementationBtn} alt="Implementation" className="h-24 sm:h-32 mb-4 object-contain" />
      <span className="text-white text-lg font-semibold">Implementation</span>
      <span className="mt-2 h-1 w-12 bg-yellow-400 scale-x-0 group-hover:scale-x-100 transition-transform origin-left rounded-full" />
    </div>
  )}
</div>

      </div>
    </div>
  );
};

export default PhaseSelectionPage;
