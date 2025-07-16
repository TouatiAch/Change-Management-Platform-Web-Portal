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
  import outlookImg from "../assets/images/outlook.png"; // adjust path if needed

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
  const DetailsPage2: React.FC<DetailsPageProps> = ({ fieldsConfig }) => {
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

    // Glass section color based on status
    const getSectionGlassClass = (closed: boolean) =>
      closed
        ? "bg-green-400/20 border-green-300/30"
        : "bg-red-400/20 border-red-300/30";

    function getSectionStatus(endDateValue?: string) {
      return endDateValue && /\d/.test(endDateValue) ? "Closed" : "Open";
    }
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
          if (!listId) return setError("Feasibility list not configured");

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

    // Dynamically recalculate Working Days
    useEffect(() => {
      if (!item || !project || !config) return;

      const dateGroups = [
        {
          start: "StartdateProcessinfo",
          end: "EnddateProcessinfo",
          working: "WorkingDaysProcess",
        },
        {
          start: "StartdatePhase4",
          end: "EnddatePhase4",
          working: "WorkingDaysPhase4",
        },
        {
          start: "StartdatePAVPhase4",
          end: "EnddatePAVPhase4",
          working: "WorkingDaysPAVPhase4",
        },
      ];

      dateGroups.forEach(({ start, end, working }) => {
        const startVal = f[start];
        const endVal = f[end];

        if (startVal && endVal) {
          const calculated = calculateWorkingDays(startVal, endVal);
          if (
            calculated &&
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
      f.StartdatePhase4, f.EnddatePhase4,
      f.StartdatePAVPhase4, f.EnddatePAVPhase4,
      item, project, config
    ]);

    if (error) return <div className="p-8 text-red-600">{error}</div>;
    if (!item || !project || !config) return null;

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

    // Editable process fields
    const processInfoEditableKeys = [
      "DeadlineTBT", "Modelyear", "Realizationplanned", "Approxrealizationdate", "OEMChangenumber"
    ];

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
    const phase4Closed = getSectionStatus(f.EnddatePhase4) === "Closed";
    const pavClosed = getSectionStatus(f.EnddatePAVPhase4) === "Closed";

    return (
      <div
        className="relative w-full min-h-screen bg-cover bg-center text-white"
        style={{ backgroundImage: `url(${harnessBg})` }}
      >
        <ToastContainer />
        <TopMenu />
        <button
          onClick={() => navigate(`/changes/${projectKey}/feasibility`)}
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

            {/* --- Phase 4 --- */}
            <div className={`border backdrop-blur-md rounded-xl shadow-lg p-6 mb-8 ${getSectionGlassClass(phase4Closed)}`}>
              <div className="flex flex-col sm:flex-row justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-semibold text-white/80 mb-1">Phase 4</h3>
                  <span className="text-lg text-blue-200 font-semibold mt-1">
                    {getSectionStatus(f.EnddatePhase4)}
                  </span>
                </div>
                {renderSectionDates(
                  "StartdatePhase4",
                  "EnddatePhase4",
                  "WorkingDaysPhase4"
                )}
              </div>
            </div>

            {/* --- PAV Subsection --- */}
            <div className={`border backdrop-blur-md rounded-xl shadow-lg p-6 mb-8 relative ${getSectionGlassClass(pavClosed)}`}>
              <div className="flex flex-col sm:flex-row justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-semibold text-white/80 mb-1">PAV Subsection</h3>
                  <span className="text-lg text-blue-200 font-semibold mt-1">
                    {getSectionStatus(f.EnddatePAVPhase4)}
                  </span>
                </div>
                {renderSectionDates(
                  "StartdatePAVPhase4",
                  "EnddatePAVPhase4",
                  "WorkingDaysPAVPhase4"
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  "EstimatedcostsPAVPhase4",
                  "ToolsutilitiesavailablePAVPhase4",
                  "ProcessFMEAPAVPhase4",
                  "PLPRelevantPAVPhase4",
                  "RisklevelactualPAVPhase4",
                  "Estimatedscrap",
                  "Estimatedcost",
                  "Estimateddowntime",
                  "estimatedchangedate",
                ].map((key) =>
                  renderField(
                    {
                      label:
                        fieldsConfig.editableFields.find((fld) => fld.key === key)
                          ?.label || key,
                      key,
                    },
                    true
                  )
                )}
              </div>
            <div className="absolute right-8 bottom-8">
    <button
      onClick={() =>
        navigate(`/send-email/${projectKey}/feasibility/${itemId}`)
      }
      className="flex items-center gap-4 px-12 py-7 rounded-2xl text-2xl font-semibold shadow-lg bg-white/20 text-white hover:bg-yellow-400/80 hover:text-black transition duration-200"
    >
      <img
        src={outlookImg}
        alt="Send Email"
        className="w-14 h-14 object-contain"
        style={{ background: "none" }}
      />
      Send Email
    </button>
  </div>

            </div>
          </div>
        </div>
      </div>
    );
  };

  export default DetailsPage2;
