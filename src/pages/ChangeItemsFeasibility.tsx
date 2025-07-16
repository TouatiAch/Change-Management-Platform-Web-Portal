// src/pages/ChangeItemsFeasibility.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { getAccessToken } from "../auth/getToken";
import harnessBg from "../assets/images/harness-bg.png";
import { msalInstance } from "../auth/msalInstance";
import { PROJECT_LOGO_MAP } from "../constants/projects";
import TopMenu from "../components/TopMenu";

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

// Helper to pick the tail-badge color by area
const getAreaColor = (areaName: string): string => {
  switch (areaName) {
    case "Cockpit":
      return "bg-green-500 text-white";
    case "MR":
      return "bg-purple-500 text-white";
    case "Innenraum":
      return "bg-yellow-500 text-black";
    case "Autarke":
      return "bg-red-500 text-white";
    default:
      return "bg-white text-gray-800";
  }
};

// Excel-serial → ISO yyyy-mm-dd
function excelSerialDateToJSDate(serial: number): string {
  // adjust for Excel’s 1900 leap-year bug
  const adjusted = serial > 59 ? serial - 1 : serial;
  const utcDays = adjusted - 25569;
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000).toISOString().slice(0, 10);
}
const ChangeItemsFeasibility: React.FC = () => {
  const { projectKey } = useParams<{ projectKey: string }>();
  const navigate = useNavigate();

  // raw fetched items + any error
  const [items, setItems] = useState<ChangeItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Pagination for “open” and “closed” tables
  const [page, setPage] = useState(0);
  const [closedPage, setClosedPage] = useState(0);
  const pageSize = 5;

  // DRX filters
  const [searchYear, setSearchYear] = useState("");
  const [searchMonth, setSearchMonth] = useState("");
  const [searchDay, setSearchDay] = useState("");
  const [searchId, setSearchId] = useState("");

  // Area filter
  const [areaFilter, setAreaFilter] = useState("all");

  // Project metadata
  const [project, setProject] = useState<IProject | null>(null);
  // Grab the “Parameters” text from the first item (if any)
  const parametersText = items[0]?.fields.Parameters || "";
  const fromMatch = parametersText.match(/Start date from:\s*(\d+)/i);
  const toMatch   = parametersText.match(/Start date to:\s*(\d+)/i);

  const startDateFrom = fromMatch
    ? excelSerialDateToJSDate(parseInt(fromMatch[1], 10))
    : "";
  const startDateTo = toMatch
    ? excelSerialDateToJSDate(parseInt(toMatch[1], 10))
    : "";

  // Which areas exist in the data?
  const areaNames = ["Innenraum", "Cockpit", "MR", "Autarke"];
  const totalCountForArea = (area: string) =>
    items.filter(i => i.fields.SheetName === area).length;
  const activeAreas = areaNames.filter(area => totalCountForArea(area) > 0);

  // Count by Status & Area (for the summary table)
  const countByStatusAndArea = (status: string, area: string) =>
    items.filter(i =>
      i.fields.Status?.toLowerCase() === status.toLowerCase() &&
      (area === "all" || i.fields.SheetName === area)
    ).length;

  const areaColors: Record<string, string> = {
    Cockpit: "bg-green-500 text-white",
    MR: "bg-purple-500 text-white",
    Innenraum: "bg-yellow-500 text-black",
    Autarke: "bg-red-500 text-white",
    all: "bg-blue-500 text-white",
  };
  const gridColumns = "2fr 1.5fr 1fr 1fr 1fr 1fr 1fr";
  // Reusable base filter: DRX + area
  const baseFilter = (item: ChangeItem, status: string) => {
    const f = item.fields;
    // Phase-4 start must exist
    if (!f.StartdatePhase4 || !/[0-9]/.test(f.StartdatePhase4)) return false;
    // Match the desired status
    if (!f.Status || f.Status.toLowerCase() !== status) return false;
    // DRX filters
    if (searchYear  && f.processyear  !== searchYear)  return false;
    if (searchMonth && f.processmonth !== searchMonth) return false;
    if (searchDay   && f.processday   !== searchDay)   return false;
    if (searchId    && f.processid    !== searchId)    return false;
    // Area filter
    const area = f.SheetName || "";
    if (areaFilter !== "all" && area !== areaFilter) return false;
    return true;
  };

  // Open items
  const filteredItems = items.filter(i => baseFilter(i, "open"));
  const pageCount      = Math.ceil(filteredItems.length / pageSize);
  const currentItems   = filteredItems.slice(page * pageSize, page * pageSize + pageSize);

  // Closed items
  const closedFiltered   = items.filter(i => baseFilter(i, "closed"));
  const closedPageCount  = Math.ceil(closedFiltered.length / pageSize);
  const closedCurrentItems = closedFiltered.slice(
    closedPage * pageSize,
    closedPage * pageSize + pageSize
  );
  useEffect(() => {
    (async () => {
      const raw = localStorage.getItem("cmConfigLists");
      if (!raw) return setError("Configuration missing");

      let config: SavedConfig;
      try { config = JSON.parse(raw); }
      catch { return setError("Invalid configuration data"); }

      const found = config.projects.find(p => p.id === projectKey);
      if (!found) return setError("No such project in config");

      setProject({
        ...found,
        logo: PROJECT_LOGO_MAP[found.id.toLowerCase()] || PROJECT_LOGO_MAP["other"],
      });

      const listId = found.mapping.implementation;
      if (!listId) return setError("No list assigned");

      const account = msalInstance.getActiveAccount();
      if (!account) return setError("User not logged in. Please sign in first.");

      const token = await getAccessToken(msalInstance, ["https://graph.microsoft.com/Sites.Read.All"]);
      if (!token) return setError("Authentication failed");

      try {
        const resp = await axios.get(
          `https://graph.microsoft.com/v1.0/sites/${config.siteId}/lists/${listId}/items?expand=fields&$top=5000`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        let fetched: ChangeItem[] = resp.data.value.map((it: any) => ({
          id: it.id,
          fields: it.fields,
        }));
        // sort open-phase4-PAV-missing → top
        fetched.sort((a, b) => {
          const aHas = /[0-9]/.test(a.fields.EnddatePAVPhase4);
          const bHas = /[0-9]/.test(b.fields.EnddatePAVPhase4);
          if (!aHas && bHas) return -1;
          if ( aHas && !bHas) return  1;
          return 0;
        });
        setItems(fetched);
      } catch (e: any) {
        setError(e.response?.data?.error?.message || e.message);
      }
    })();
  }, [projectKey]);
  if (error) {
    return <div className="p-8 text-red-600 text-lg">Error: {error}</div>;
  }

  const handleAreaFilter = (newArea: string) => {
    setPage(0);
    setClosedPage(0);
    setAreaFilter(newArea);
  };

    return (
    <div
      className="relative w-full min-h-screen bg-cover bg-center text-lg"
      style={{ backgroundImage: `url(${harnessBg})` }}
    >
      <div className="absolute inset-0 z-10 pointer-events-none" />

      {/* TopBar */}
      <div className="relative z-20 w-full flex items-center justify-between px-8 py-4 text-white">
        <TopMenu />
        <button
          onClick={() => navigate(`/changes/${projectKey}`)}
          className="flex items-center space-x-2 px-3 py-2 bg-white/20 hover:bg-white/30 backdrop-blur rounded-2xl shadow-md text-white text-sm transition"
        >
          ← Back
        </button>
      </div>

      {/* Title */}
      <div className="text-center text-white text-3xl font-bold py-4">
        Feasibility Changes for <span className="uppercase">{projectKey}</span>
      </div>

      {/* Logo / Dates / Summary */}
      <div className="relative z-20 max-w-6xl mx-auto flex gap-4 px-4 py-4 items-stretch h-[330px]">
        {/* Logo */}
        <div className="flex items-center justify-center bg-white/10 rounded-md p-4 w-1/4 h-full">
          {project?.logo && (
            <img
              src={project.logo}
              alt={`${project.displayName} logo`}
              className="object-contain max-h-full"
            />
          )}
        </div>

        {/* Dates */}
        <div className="flex items-center justify-center bg-white/10 backdrop-blur-md shadow-md rounded-2xl p-6 w-1/4 h-full text-white text-center border border-white/20">
          <div className="space-y-4">
            <div>
              <p className="text-lg font-semibold text-white/80 mb-1">Period From</p>
              <p className="text-xl font-bold text-green-300">
                {startDateFrom || "—"}
              </p>
            </div>
            <div>
              <p className="text-lg font-semibold text-white/80 mb-1">To</p>
              <p className="text-xl font-bold text-green-300">
                {startDateTo || "—"}
              </p>
            </div>
          </div>
        </div>

        {/* DRX + Area Filters + Summary */}
        <div className="flex flex-col justify-between bg-white/10 backdrop-blur-md shadow-md rounded-2xl p-6 w-1/2 h-full text-white border border-white/20">
          {/* DRX Filters */}
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-wrap gap-4 items-end">
              {/* DRX label */}
              <div className="flex flex-col items-start">
                <label className="text-sm text-white/80 mb-1 invisible">Label</label>
                <p className="text-lg font-semibold text-white/90">DRX</p>
              </div>

              {/* Year */}
              <div className="flex flex-col items-start">
                <label className="text-sm text-white/80 mb-1">Year</label>
                <select
                  value={searchYear}
                  onChange={e => { setPage(0); setSearchYear(e.target.value); }}
                  className="p-[6px] rounded bg-white text-black font-semibold w-20"
                >
                  <option value="">Any</option>
                  {["2024", "2025", "2026", "2027"].map(y => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Month */}
              <div className="flex flex-col items-start">
                <label className="text-sm text-white/80 mb-1">Month</label>
                <select
                  value={searchMonth}
                  onChange={e => { setPage(0); setSearchMonth(e.target.value); }}
                  className="p-[6px] rounded bg-white text-black font-semibold w-20"
                >
                  <option value="">Any</option>
                  {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0")).map(m => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Day */}
              <div className="flex flex-col items-start">
                <label className="text-sm text-white/80 mb-1">Day</label>
                <select
                  value={searchDay}
                  onChange={e => { setPage(0); setSearchDay(e.target.value); }}
                  className="p-[6px] rounded bg-white text-black font-semibold w-20"
                >
                  <option value="">Any</option>
                  {Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, "0")).map(d => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* ID */}
              <div className="flex flex-col items-start">
                <label className="text-sm text-white/80 mb-1">ID</label>
                <input
                  type="text"
                  placeholder="ID"
                  value={searchId}
                  onChange={e => { setPage(0); setSearchId(e.target.value); }}
                  className="p-[6px] rounded bg-white text-black font-semibold w-20"
                />
              </div>
            </div>
          </div>

          {/* Summary Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-center text-white border-separate border-spacing-y-2">
              <thead>
                <tr>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">
                    <button
                      onClick={() => handleAreaFilter("all")}
                      className={`px-4 py-1 rounded-full text-sm font-semibold ${
                        areaFilter === "all" ? areaColors.all : "bg-white text-black"
                      }`}
                    >
                      All
                    </button>
                  </th>
                  {activeAreas.map(area => (
                    <th key={area} className="pb-2">
                      <button
                        onClick={() => handleAreaFilter(area)}
                        className={`px-4 py-1 rounded-full text-sm font-semibold ${
                          areaFilter === area ? areaColors[area] : "bg-white text-black"
                        }`}
                      >
                        {area}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {["open", "closed", "cancelled"].map(status => (
                  <tr key={status} className="text-md font-medium">
                    <td className="capitalize">{status}</td>
                    <td>{countByStatusAndArea(status, "all")}</td>
                    {activeAreas.map(area => (
                      <td key={area}>{countByStatusAndArea(status, area)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ——— Open Items + Pagination ——— */}
      <div className="relative z-20 max-w-6xl mx-auto px-4 pb-8 space-y-4 text-white">
        {/* Table Header */}
        <div
          className="grid items-center p-4 bg-white/10 border border-white/20 backdrop-blur-md rounded-2xl shadow-md"
          style={{ gridTemplateColumns: gridColumns }}
        >
          <span className="font-semibold">Change ID</span>
          <span className="font-semibold">OEM Offer Change</span>
          <span className="font-semibold text-center">PAV Phase 4 End</span>
          <span className="font-semibold text-center">Phase 4 End</span>
          <span className="font-semibold text-center">Process End</span>
          <span className="font-semibold text-center">Area</span>
          <span />
        </div>

        {currentItems.map(item => {
          const f = item.fields;
          const drx = f.Processnumber;
          const risk1 = f.OEMOfferChangenumber;
          const pav = f.EnddatePAVPhase4;
          const ph4 = f.EnddatePhase4;
          const pi = f.EnddateProcessinfo;
          const area = f.SheetName;
          const areaClasses = getAreaColor(area);
          const hasDigit = /[0-9]/.test(pav);

          return (
            <div
              key={item.id}
              onClick={() => navigate(`/details/${projectKey}/feasibility/${item.id}`)}
              className="group relative grid h-20 items-center p-4 bg-white/10 border border-white/20 backdrop-blur-md rounded-2xl shadow-md cursor-pointer hover:bg-white/20 transition"
              style={{ gridTemplateColumns: gridColumns }}
            >
              <span className="flex items-center font-semibold">
                {!hasDigit && (
                  <span className="relative flex items-center justify-center w-5 h-5 mr-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping"></span>
                    <span className="relative w-3 h-3 bg-red-500 rounded-full"></span>
                  </span>
                )}
                {drx || ""}
              </span>

              <span className="font-semibold overflow-hidden whitespace-nowrap text-ellipsis">
                {risk1 || ""}
              </span>

              <span className={`justify-self-center px-2 py-1 rounded-full text-sm font-semibold ${pav ? "bg-green-400 text-white" : "bg-red-400 text-white"}`}>
                {pav ? "Closed" : "Open"}
              </span>

              <span className={`justify-self-center px-2 py-1 rounded-full text-sm font-semibold ${ph4 ? "bg-green-400 text-white" : "bg-red-400 text-white"}`}>
                {ph4 ? "Closed" : "Open"}
              </span>

              <span className={`justify-self-center px-2 py-1 rounded-full text-sm font-semibold ${pi ? "bg-green-400 text-white" : "bg-red-400 text-white"}`}>
                {pi ? "Closed" : "Open"}
              </span>

              <span
                className={`justify-self-center px-2 py-1 rounded-full text-sm font-semibold ${areaClasses}`}
                title={`Area: ${area}`}
              >
                {area || "—"}
              </span>

              <span className="absolute bottom-0 left-0 w-full h-1 bg-yellow-400 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-b-full" />
            </div>
          );
        })}

        {/* Pagination for Open */}
        {pageCount > 1 && (
          <div className="flex justify-center items-center space-x-8 mt-4 text-white">
            <button
              onClick={() => setPage(prev => Math.max(prev - 1, 0))}
              disabled={page === 0}
              className="text-3xl disabled:opacity-50"
            >
              ‹
            </button>
            <span className="text-lg font-medium">{page + 1} / {pageCount}</span>
            <button
              onClick={() => setPage(prev => Math.min(prev + 1, pageCount - 1))}
              disabled={page === pageCount - 1}
              className="text-3xl disabled:opacity-50"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* ——— Closed Items + Pagination ——— */}
      <div className="relative z-20 max-w-6xl mx-auto px-4 pb-8 space-y-4 text-white">
        <div className="text-xl font-bold">Closed Changes</div>

        {/* Table Header */}
        <div
          className="grid items-center p-4 bg-white/10 border border-white/20 backdrop-blur-md rounded-2xl shadow-md"
          style={{ gridTemplateColumns: gridColumns }}
        >
          <span className="font-semibold">Change ID</span>
          <span className="font-semibold">OEM Offer Change</span>
          <span className="font-semibold text-center">PAV Phase 4 End</span>
          <span className="font-semibold text-center">Phase 4 End</span>
          <span className="font-semibold text-center">Process End</span>
          <span className="font-semibold text-center">Area</span>
          <span />
        </div>

        {closedCurrentItems.map(item => {
          const f = item.fields;
          const drx = f.Processnumber;
          const risk1 = f.OEMOfferChangenumber;
          const pav = f.EnddatePAVPhase4;
          const ph4 = f.EnddatePhase4;
          const pi = f.EnddateProcessinfo;
          const area = f.SheetName;
          const areaClasses = getAreaColor(area);
          const hasDigit = /[0-9]/.test(pav);

          return (
            <div
              key={"closed-" + item.id}
              onClick={() => navigate(`/details/${projectKey}/feasibility/${item.id}`)}
              className="group relative grid h-20 items-center p-4 bg-white/10 border border-white/20 backdrop-blur-md rounded-2xl shadow-md cursor-pointer hover:bg-white/20 transition"
              style={{ gridTemplateColumns: gridColumns }}
            >
              <span className="flex items-center font-semibold">
                {!hasDigit && (
                  <span className="relative flex items-center justify-center w-5 h-5 mr-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping"></span>
                    <span className="relative w-3 h-3 bg-red-500 rounded-full"></span>
                  </span>
                )}
                {drx || ""}
              </span>

              <span className="font-semibold overflow-hidden whitespace-nowrap text-ellipsis">
                {risk1 || ""}
              </span>

              <span className={`justify-self-center px-2 py-1 rounded-full text-sm font-semibold ${pav ? "bg-green-400 text-white" : "bg-red-400 text-white"}`}>
                {pav ? "Closed" : "Open"}
              </span>

              <span className={`justify-self-center px-2 py-1 rounded-full text-sm font-semibold ${ph4 ? "bg-green-400 text-white" : "bg-red-400 text-white"}`}>
                {ph4 ? "Closed" : "Open"}
              </span>

              <span className={`justify-self-center px-2 py-1 rounded-full text-sm font-semibold ${pi ? "bg-green-400 text-white" : "bg-red-400 text-white"}`}>
                {pi ? "Closed" : "Open"}
              </span>

              <span
                className={`justify-self-center px-2 py-1 rounded-full text-sm font-semibold ${areaClasses}`}
                title={`Area: ${area}`}
              >
                {area || "—"}
              </span>

              <span className="absolute bottom-0 left-0 w-full h-1 bg-yellow-400 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-b-full" />
            </div>
          );
        })}

        {/* Pagination for Closed */}
        {closedPageCount > 1 && (
          <div className="flex justify-center items-center space-x-8 mt-4 text-white">
            <button
              onClick={() => setClosedPage(prev => Math.max(prev - 1, 0))}
              disabled={closedPage === 0}
              className="text-3xl disabled:opacity-50"
            >
              ‹
            </button>
            <span className="text-lg font-medium">{closedPage + 1} / {closedPageCount}</span>
            <button
              onClick={() => setClosedPage(prev => Math.min(prev + 1, closedPageCount - 1))}
              disabled={closedPage === closedPageCount - 1}
              className="text-3xl disabled:opacity-50"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );

};

export default ChangeItemsFeasibility;
