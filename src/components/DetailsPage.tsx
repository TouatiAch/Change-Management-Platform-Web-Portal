import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { getAccessToken } from "../auth/getToken";
import { msalInstance } from "../auth/msalInstance";
import harnessBg from "../assets/images/harness-bg.png";
import { PROJECT_LOGO_MAP } from "../constants/projects";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import TopMenu from "./TopMenu";

interface FieldEntry {
  label: string;
  key: string;
}

interface FieldsConfig {
  generalFields: FieldEntry[];
  editableFields: FieldEntry[];
  startEndWorkingGroup: FieldEntry[];
}

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

interface SavedConfig {
  siteId: string;
  projects: IProject[];
}

interface ChangeItem {
  id: string;
  fields: Record<string, any>;
}

interface DetailsPageProps {
  fieldsConfig: FieldsConfig;
}

// --- Helpers for status, working days etc ---
const getSectionGlassClass = (closed: boolean) =>
  closed
    ? "bg-green-400/20 border-green-300/30"
    : "bg-red-400/20 border-red-300/30";

function getSectionStatus(endDateValue?: string) {
  return endDateValue && /\d/.test(endDateValue) ? "Closed" : "Open";
}

// --- Robust ISO date normalization helper ---
function toISODate(str?: string|null): string|null {
  if (!str) return null;
  // allow 1 or 2 digits for day/month, and 2 or 4 digits for year
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(str);
  if (!m) return null;
  let [ , dd, mm, yy ] = m;
  // normalize to 2-digit day/month
  if (dd.length === 1) dd = '0'+dd;
  if (mm.length === 1) mm = '0'+mm;
  // normalize 2-digit year to 4-digit (assuming 20xx)
  const yyyy = yy.length === 2 ? '20'+yy : yy;
  return `${yyyy}-${mm}-${dd}`;
}


// --- Robust working days calculation ---
const calculateWorkingDays = (start: string, end: string): number | string => {
  try {
    const sISO = toISODate(start);
    const eISO = toISODate(end);
    if (!sISO || !eISO) return "";
    const s = new Date(sISO);
    const e = new Date(eISO);
    if (isNaN(s as any) || isNaN(e as any)) return "";
    let count = 0;
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) count++;
    }
    return count;
  } catch {
    return "";
  }
};

// --- Main Component ---
const DetailsPage: React.FC<DetailsPageProps> = ({ fieldsConfig }) => {
  const { projectKey, itemId } = useParams<{ projectKey: string; itemId: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<ChangeItem | null>(null);
  const [project, setProject] = useState<IProject | null>(null);
  const [config, setConfig] = useState<SavedConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setIsSaving] = useState<boolean>(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editedValue, setEditedValue] = useState<string>("");

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingField]);

  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem("cmConfigLists");
        if (!raw) return setError("Configuration missing");
        const loadedConfig: SavedConfig = JSON.parse(raw);
        setConfig(loadedConfig);

        const foundProject = loadedConfig.projects.find((p) => p.id === projectKey);
        if (!foundProject) return setError("Project not found");

        const patchedProject = {
          ...foundProject,
          logo: PROJECT_LOGO_MAP[foundProject.id.toLowerCase()] || PROJECT_LOGO_MAP["other"],
        };
        setProject(patchedProject);

        const listId = foundProject.mapping.implementation;
        if (!listId) return setError("Implementation list not configured");

        const account = msalInstance.getActiveAccount();
        if (!account) return setError("No signed-in user");
        const token = await getAccessToken(msalInstance, ["https://graph.microsoft.com/Sites.Read.All"]);
        if (!token) return setError("Authentication failed");

        const resp = await axios.get<ChangeItem>(
          `https://graph.microsoft.com/v1.0/sites/${loadedConfig.siteId}/lists/${listId}/items/${itemId}?expand=fields`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setItem(resp.data);
      } catch (e: any) {
        setError(e.response?.data?.error?.message || e.message);
      }
    })();
  }, [projectKey, itemId]);

  const f = item?.fields || {};

  // --- Auto-calculate working days ---
  useEffect(() => {
    if (!item || !project || !config) return;

    const dateGroups = [
      {
        start: "StartdateProcessinfo",
        end: "EnddateProcessinfo",
        working: "WorkingDaysProcess",
      },
      {
        start: "StartdatePhase8",
        end: "EnddatePhase8",
        working: "WorkingDaysPAVPhase8",
      },
    ];

    dateGroups.forEach(({ start, end, working }) => {
      const startVal = f[start];
      const endVal = f[end];

      if (startVal && endVal) {
        const calculated = calculateWorkingDays(startVal, endVal);
        if (
          calculated !== "" &&
          String(f[working] || "") !== String(calculated)
        ) {
          handleSave(working, String(calculated));
        }
      }
    });
    // eslint-disable-next-line
  }, [
    f.StartdateProcessinfo, f.EnddateProcessinfo,
    f.StartdatePhase8, f.EnddatePhase8,
    item, project, config
  ]);

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!item || !project || !config) return null;

  // Field input type logic
  const getInputType = (key: string) => {
    const k = key.toLowerCase();
    if (k.includes("date")) return "text";
    if (k.includes("cost") || k.includes("downtime") || k.includes("workingdays") || k.includes("scrap")) return "number";
    return "text";
  };

  const handleEditStart = (fieldKey: string, currentVal: string) => {
    setEditingField(fieldKey);
    setEditedValue(currentVal);
  };

  const handleSave = async (fieldKey: string, newValue: string) => {
    if (f[fieldKey] === newValue) {
      setEditingField(null);
      return;
    }

    setIsSaving(true);
    try {
      const token = await getAccessToken(msalInstance, ["https://graph.microsoft.com/Sites.Manage.All"]);
      const listId = project?.mapping?.implementation;
      const updatePayload = { [fieldKey]: newValue };

      await axios.patch(
        `https://graph.microsoft.com/v1.0/sites/${config?.siteId}/lists/${listId}/items/${itemId}/fields`,
        updatePayload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setItem((prev) =>
        prev ? { ...prev, fields: { ...prev.fields, [fieldKey]: newValue } } : prev
      );
      toast.success("Saved");
    } catch (e: any) {
      toast.error("Save failed");
    } finally {
      setIsSaving(false);
      setEditingField(null);
    }
  };

  // --- Unified editable field rendering ---
  const renderField = (field: FieldEntry, editable = true) => {
    const value = f[field.key] ?? "";
    return (
      <div key={field.key} className="mb-5">
        <label className="block font-semibold mb-1 text-white">{field.label}</label>
        {editingField === field.key && editable ? (
          <input
            ref={inputRef}
            className="w-full px-4 py-2 bg-white/80 text-black rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-blue-400"
            type={getInputType(field.key)}
            value={editedValue}
            onChange={(e) => setEditedValue(e.target.value)}
            onBlur={() => handleSave(field.key, editedValue)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave(field.key, editedValue);
            }}
          />
        ) : (
          <div
            className="w-full px-4 py-2 bg-white/80 text-black rounded-xl shadow-sm"
            onClick={
              editable ? () => handleEditStart(field.key, value) : undefined
            }
            style={editable ? { cursor: "pointer" } : undefined}
          >
            {value || "—"}
          </div>
        )}
      </div>
    );
  };

  // --- Date/Working Days row, always aligned ---
  const renderSectionDates = (
    startKey: string,
    endKey: string,
    workingDaysKey: string
  ) => {
    return (
      <div className="flex gap-4 items-end min-w-[320px]">
        {/* Start Date */}
        <div className="flex flex-col w-32">
          <label className="block font-semibold mb-1 text-white">Start date</label>
           {editingField === startKey ? (
            <input
              ref={inputRef}
              className="w-full px-4 py-2 bg-white/80 text-black rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-blue-400"
              type="text"
              placeholder="DD/MM/YYYY"
              value={editedValue}
              onChange={(e) => setEditedValue(e.target.value)}
              onBlur={() => handleSave(startKey, editedValue)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave(startKey, editedValue);
              }}
            />
          ) : (
           <div
              className="w-full px-4 py-2 bg-white/80 text-black rounded-xl shadow-sm cursor-pointer text-center"
              onClick={() => handleEditStart(startKey, f[startKey] ?? "")}
            >
              {f[startKey] || "—"}
            </div>
          )}
        </div>
        {/* End Date */}
        <div className="flex flex-col w-32">
          <label className="block font-semibold mb-1 text-white">End date</label>
          {editingField === endKey ? (
            <input
              ref={inputRef}
              className="w-full px-4 py-2 bg-white/80 text-black rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-blue-400"
              type="text"
              placeholder="DD/MM/YYYY"
              value={editedValue}
              onChange={(e) => setEditedValue(e.target.value)}
              onBlur={() => handleSave(endKey, editedValue)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave(endKey, editedValue);
              }}
            />
          ) : (
            <div
              className="w-full px-4 py-2 bg-white/80 text-black rounded-xl shadow-sm cursor-pointer text-center"
              onClick={() => handleEditStart(endKey, f[endKey] ?? "")}
            >
              {f[endKey] || "—"}
            </div>
          )}
        </div>
        {/* Working Days */}
        <div className="flex flex-col w-24">
          <label className="block font-semibold mb-1 text-white">Working Days</label>
          <div className="w-full">
            <div className="w-full px-4 py-2 bg-white/80 text-black rounded-xl shadow-sm text-center">
              {f[workingDaysKey] || "—"}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Status for highlighting
  const processClosed = getSectionStatus(f.EnddateProcessinfo) === "Closed";
  const phase8Closed = getSectionStatus(f.EnddatePhase8) === "Closed";

  // Editable keys for process info
  const processInfoEditableKeys = [
    "DeadlineTBT", "Modelyear", "Realizationplanned", "Approxrealizationdate", "OEMChangenumber"
  ];

  return (
    <div
      className="relative w-full min-h-screen bg-cover bg-center text-white"
      style={{ backgroundImage: `url(${harnessBg})` }}
    >
      <ToastContainer />
      <TopMenu />
      <button
        onClick={() => navigate(`/changes/${projectKey}/implementation`)}
        className="absolute top-4 left-4 z-20 flex items-center space-x-2 px-3 py-2 bg-white/20 hover:bg-white/30 backdrop-blur rounded-2xl shadow-md text-white text-sm transition"
      >
        ← Back
      </button>

      <div className="max-w-6xl mx-auto min-h-[600px]">
        <div className="relative z-20 w-full p-6 bg-white/10 border border-white/20 backdrop-blur-md rounded-xl shadow-xl max-w-full">
          {/* HEADER */}
          <div className="text-center mb-8">
            {project?.logo && (
              <img
                src={project.logo}
                alt="logo"
                className="w-32 h-auto mx-auto mb-4"
                style={{ maxHeight: 120 }}
              />
            )}
            <h1 className="text-3xl font-bold text-white/90">Change Details</h1>
          </div>

          {/* --- Process Information --- */}
          <div className={`border backdrop-blur-md rounded-xl shadow-lg p-6 mb-8 ${getSectionGlassClass(processClosed)}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-semibold text-white/80 mb-1">Process Information</h3>
                <span className="text-lg text-blue-200 font-semibold mt-1">
                  {f.Status || "Unknown"}
                </span>
              </div>
              {renderSectionDates(
                "StartdateProcessinfo",
                "EnddateProcessinfo",
                "WorkingDaysProcess"
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {fieldsConfig.generalFields
                .filter(field =>
                  !["StartdateProcessinfo", "EnddateProcessinfo", "WorkingDaysProcess"].includes(field.key)
                )
                .map(field =>
                  renderField(field, processInfoEditableKeys.includes(field.key))
                )
              }
            </div>
          </div>

          {/* --- Phase 8 --- */}
          <div className={`border backdrop-blur-md rounded-xl shadow-lg p-6 mb-8 ${getSectionGlassClass(phase8Closed)}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-semibold text-white/80 mb-1">Phase 8</h3>
                <span className="text-lg text-blue-200 font-semibold mt-1">
                  {getSectionStatus(f.EnddatePhase8)}
                </span>
              </div>
              {renderSectionDates(
                "StartdatePhase8",
                "EnddatePhase8",
                "WorkingDaysPAVPhase8"
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {fieldsConfig.editableFields.map(field =>
                renderField(field, true)
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailsPage;
