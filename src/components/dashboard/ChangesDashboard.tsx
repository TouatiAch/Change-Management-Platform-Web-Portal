import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";

import { getAccessToken } from "../../auth/getToken";
import { msalInstance } from "../../auth/msalInstance";

import { db } from "../../pages/db";
import { AreaImage } from "../../pages/types";

import drxIcon from "../../assets/images/drx.png";
import downtimeIcon from "../../assets/images/downtime.png";
import budgetIcon from "../../assets/images/budget.png";
import followupIcon from "../../assets/images/costs.png";
import scrapIcon from "../../assets/images/scrap.png";
import changesIcon from "../../assets/images/changes.png";
import closurePhase4Icon from "../../assets/images/phase4closure.png";
import { getConfig } from "../../services/configService";
import ProjectPhase4DaysTable from "./ProjectPhase4DaysTable";
import StatsCards from "./changes/StatsCards";
import { ScrapPieChart } from "./scrap/ScrapPieChart";
import { UnplannedDowntimeChart } from "./downtime/UnplannedDowntimeChart";
import DraxlOverview from "./changes/DraxlOverview";
import { ChangeStatusSemiPieChart } from "./phase 4 closure/ChangeStatusSemiPieChart";
import { FollowupCostTimeSeriesChart } from "./followupcost/FollowupCostTimeSeriesChart";
import { FollowupCostByProjectReasonChart } from "./followupcost/FollowupCostByProjectReasonChart";
import { FollowupCostByReasonTimeSeriesChart } from "./followupcost/FollowupCostByReasonTimeSeriesChart";
import { FollowupCostSubProjectChart } from "./followupcost/FollowupCostSubProjectChart";
import { FollowupCostProjectTimeSeriesChart } from "./followupcost/FollowupCostProjectTimeSeriesChart";
import type { ListConfig } from "../../services/configService";
import DRXEntriesChart from "./drx/DRXEntriesChart";
import BudgetEntriesChart from "./budget/BudgetEntriesChart";
import { ProjectCostWithTargetChart } from "./followupcost/ProjectCostWithTargetChart";
import { MonthlyTargetTable } from "./followupcost/MonthlyTargetTable";
const apiTabs = [
  { key: "changes", label: "Changes", icon: changesIcon },
  { key: "unplannedDowntime", label: "Unplanned Downtime", icon: downtimeIcon },
  { key: "costPA", label: "Cost PA", icon: followupIcon },
  { key: "drxIdea", label: "DRX Idea", icon: drxIcon },
  { key: "budget", label: "Budget", icon: budgetIcon },
  { key: "scrap", label: "Scrap", icon: scrapIcon },
  { key: "closurePhase4", label: "Closure Phase 4", icon: closurePhase4Icon },

];

// Filter modes as an array for horizontal button group
const filterModes: { key: FilterMode; label: string }[] = [
  { key: "year", label: "Year" },
  { key: "quarter", label: "Quarter" },
  { key: "month", label: "Month" },
  { key: "day", label: "Day" },
  { key: "weekOfMonth", label: "Week of Month" },
  { key: "weekOfYear", label: "Week of Year" },
  { key: "customRange", label: "Custom Range" },
];

interface IProject {
  id: string;
  displayName: string;
  mapping: {
    implementation: string;
    implementationExtra?: string;
  };
}

interface cmConfigLists {
   siteId: string;
   questionsListId: string;
   lists: ListConfig[];         // ← holds your downtime, DRX, Budgets, FollowCostKPI, etc.
   projects: IProject[];
 }

interface ChangeItem {
  ID: string;
  SheetName?: string;
  Constructedspace?: string;
  Status?: string;
  EnddatePhase4?: string;
  EnddatePAVPhase4?: string;
  EnddatePhase8?: string;
  EnddateProcessinfo?:string;
  processyear?: string;
  processmonth?: string;
  processday?: string;
  Actualscrap?: number;
  Estimatedscrap?: number;
  OEM?: string;
}
export interface MonthlyKPIItem {
  ID: string;                         // your SharePoint item id
  Project: string;                    // fields.Project
  year: string;                       // fields.year
  Month: string;                      // fields.Month
  Monthid: string;                    // fields.Monthid
  DRXIdeasubmittedIdea?: number;      // fields.DRXIdeasubmittedIdea
  DRXIdeasubmittedIdeaGoal?: number;  // fields.DRXIdeasubmittedIdeaGoal
  productionminutes?: number;         // fields.productionminutes
  downtime?: number;                  // fields.downtime
  rateofdowntime?: number;            // fields.rateofdowntime
  Targetdowntime?: number;            // fields.Targetdowntime
  seuildinterventiondowntime?: number;// fields.seuildinterventiondowntime
}
export interface FollowCostItem {
  ID: string;                  // SharePoint item id
  Project: string;             // fields.Project
  Area: string;                // fields.Area
  Carline: string;             // fields.Carline
  InitiationReasons: string;   // fields.InitiationReasons
  BucketID: string;            // fields.BucketID
  Date: string;                // fields.Date (YYYY-MM-DD)
  Statut: string;              // fields.Statut
  Quantity: number;            // fields.Quantity
  NettValue: number;           // fields.NettValue
  TotalNettValue: number;      // fields.TotalNettValue
  Currency: string;            // fields.Currency
  BucketResponsible: string;   // fields.BucketResponsible
  PostnameID: string;          // fields.PostnameID
  Topic: string;               // fields.Topic
}

type FilterMode =
  | "year"
  | "quarter"
  | "month"
  | "day"
  | "semester"
  | "weekOfMonth"
  | "weekOfYear"
  | "customRange";
export const ChangesDashboard: React.FC = () => {
  
  const { project } = useParams<{ project: string }>();
const [projects, setProjects] = useState<IProject[]>([]);

  // API Source button state
  const [selectedApi, setSelectedApi] = useState<
    "changes" | "unplannedDowntime" | "costPA" | "drxIdea" | "budget" | "scrap" | "closurePhase4" 
  >("changes");

  // Items & error/loading states
  const [allItems, setAllItems] = useState<ChangeItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<ChangeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

const config = getConfig();

  // Filter mode state
  const [filterMode, setFilterMode] = useState<FilterMode>("month");

  // Current date for defaults
  const now = new Date();
  const defaultYear = String(now.getFullYear());
  const defaultMonth = String(now.getMonth() + 1).padStart(2, "0");
  const defaultDay = String(now.getDate()).padStart(2, "0");

  // State for year/month/day/quarter
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedDay, setSelectedDay] = useState(defaultDay);
  const [selectedQuarter, setSelectedQuarter] = useState("1");
const [selectedSemester, setSelectedSemester] = useState<1|2>(1);
const ALL_PROJECTS = config.projects
  .map(p => p.displayName)
  .concat("draxlameir");
const [monthlyTargets, setMonthlyTargets] = useState<Record<string, number[]>>(
  () => Object.fromEntries(
    ALL_PROJECTS.map(p => [p, Array(12).fill(0)])
  )
);
const perBucketTarget: Record<string, number> = {};

ALL_PROJECTS.forEach((proj) => {
  const arr = monthlyTargets[proj] || Array(12).fill(0);
  let val: number;
  switch (filterMode) {
    case "month":
      val = arr[Number(selectedMonth) - 1];
      break;
    case "quarter": {
      const q = Number(selectedQuarter);
      const start = (q - 1) * 3;
      val = arr.slice(start, start + 3).reduce((a, b) => a + b, 0);
      break;
    }
    case "semester": {
      const start = (selectedSemester - 1) * 6;
      val = arr.slice(start, start + 6).reduce((a, b) => a + b, 0);
      break;
    }
    case "year":
    default:
      val = arr.reduce((a, b) => a + b, 0);
  }
  perBucketTarget[proj] = val;
});
  // State for week-of-month/week-of-year
  const [selectedWeekOfMonth, setSelectedWeekOfMonth] = useState<number | null>(null);
  const [selectedWeekOfYear, setSelectedWeekOfYear] = useState<number | null>(null);

  // State for custom range
  const [fromDay, setFromDay] = useState("01");
  const [fromMonth, setFromMonth] = useState("01");
  const [fromYear, setFromYear] = useState(defaultYear);
  const [toDay, setToDay] = useState("31");
  const [toMonth, setToMonth] = useState("12");
  const [toYear, setToYear] = useState(defaultYear);

  const [areaImages, setAreaImages] = useState<AreaImage[]>([]);
  const [followCostItems, setFollowCostItems] = useState<FollowCostItem[]>([]);

  useEffect(() => {
    if (!project) return;
    db.areaImages
      .where("projectId")
      .equals(project)
      .toArray()
      .then(setAreaImages);
  }, [project]);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // ── 1️⃣ Authenticate & load config ─────────
        const token = await getAccessToken(msalInstance, [
          "https://graph.microsoft.com/Sites.Read.All",
        ]);
        if (!token) throw new Error("No token: please sign in.");

        const cfg = getConfig();
        const siteId = cfg.siteId;
        if (!siteId) throw new Error("Missing siteId in cmConfigLists.");

        // ── 2️⃣ Fetch ChangeItems ───────────────────
        const changesAccum: ChangeItem[] = [];
        const fetchListItems = async (listId: string) => {
          let nextLink = `https://graph.microsoft.com/v1.0/sites/${siteId}` +
                         `/lists/${listId}/items?expand=fields&$top=2000`;
          while (nextLink) {
            const resp = await axios.get(nextLink, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!Array.isArray(resp.data.value)) {
              throw new Error("Expected array at resp.data.value");
            }
            const pageItems = resp.data.value.map((it: any) => ({
              ID:                it.id,
              SheetName:         it.fields.SheetName,
              Constructedspace:  it.fields.Constructedspace,
              Status:            it.fields.Status,
              EnddatePhase4:     it.fields.EnddatePhase4,
              EnddatePAVPhase4:  it.fields.EnddatePAVPhase4,
              EnddatePhase8:     it.fields.EnddatePhase8,
              EnddateProcessinfo:it.fields.EnddateProcessinfo,
              processyear:       it.fields.processyear,
              processmonth:      it.fields.processmonth,
              processday:        it.fields.processday,
              OEM:               it.fields.OEM,
              Scrap:             it.fields.Scrap,
            })) as ChangeItem[];
            changesAccum.push(...pageItems);
            nextLink = resp.data["@odata.nextLink"] || "";
          }
        };

        // If “draxlmaeir” aggregate all sub–projects, else just the one mapping
        if (project?.toLowerCase() === "draxlmaeir") {
          const subs = cfg.projects.filter(p => p.mapping.implementation);
          if (!subs.length) throw new Error("No sub–projects for 'draxlmaeir'.");
          await Promise.all(
            subs.map(p => fetchListItems(p.mapping.implementation))
          );
        } else {
          const p = cfg.projects.find(p => p.id.toLowerCase() === project?.toLowerCase());
          if (!p || !p.mapping.implementation) {
            throw new Error(`Project '${project}' has no implementation list.`);
          }
          await fetchListItems(p.mapping.implementation);
        }

        if (!cancelled) {
          setAllItems(changesAccum);
        }

        // ── 3️⃣ Fetch Follow-Up Cost KPI ────────────
        const followCfg = cfg.lists.find(l => l.name === "FollowCostKPI");
        if (!followCfg) {
          console.warn("FollowCostKPI not found in config.lists");
          if (!cancelled) setFollowCostItems([]);
        } else {
          const followAccum: FollowCostItem[] = [];
          const fetchFollowCost = async (listId: string) => {
            let nextLink = `https://graph.microsoft.com/v1.0/sites/${siteId}` +
                           `/lists/${listId}/items?expand=fields&$top=2000`;
            while (nextLink) {
              const resp = await axios.get(nextLink, {
                headers: { Authorization: `Bearer ${token}` },
              });
              resp.data.value.forEach((it: any) => {
                followAccum.push({
                  ID:                 it.id,
                  Project:            it.fields.Project,
                  Area:               it.fields.Area,
                  Carline:            it.fields.Carline,
                  InitiationReasons:  it.fields.InitiationReasons,
                  BucketID:           it.fields.BucketID,
                  Date:               it.fields.Date,
                  Statut:             it.fields.Statut,
                  Quantity:           Number(it.fields.Quantity)       || 0,
                  NettValue:          Number(it.fields.NettValue)      || 0,
                  TotalNettValue:     Number(it.fields.TotalNettValue) || 0,
                  Currency:           it.fields.Currency,
                  BucketResponsible:  it.fields.BucketResponsible,
                  PostnameID:         it.fields.PostnameID,
                  Topic:              it.fields.Topic,
                });
              });
              nextLink = resp.data["@odata.nextLink"] || "";
            }
          };
          await fetchFollowCost(followCfg.listId);
          if (!cancelled) {
            setFollowCostItems(followAccum);
          }
        }
      } catch (err: any) {
        console.error(err);
        if (!cancelled) {
          setError(err.message || String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [project]);

  // Change Items Filtering
  useEffect(() => {
    if (!allItems.length) {
      setFilteredItems([]);
      return;
    }
    const newFiltered = allItems.filter((item) => {
      const y = item.processyear || "";
      const m = item.processmonth || "";
      const d = item.processday || "";

      switch (filterMode) {
        case "year":
          return y === selectedYear;
        case "month":
          return y === selectedYear && m === selectedMonth;
        case "quarter": {
          if (y !== selectedYear) return false;
          const monthNum = parseInt(m, 10);
          const q = parseInt(selectedQuarter, 10);
          if (isNaN(monthNum) || isNaN(q)) return false;
          const quarterRanges: Record<number, [number, number]> = {
            1: [1, 3],
            2: [4, 6],
            3: [7, 9],
            4: [10, 12],
          };
          const [minMonth, maxMonth] = quarterRanges[q];
          return monthNum >= minMonth && monthNum <= maxMonth;
        }
        case "day":
          return y === selectedYear && m === selectedMonth && d === selectedDay;
        case "weekOfMonth": {
          if (y !== selectedYear || m !== selectedMonth) return false;
          if (!selectedWeekOfMonth) return true;
          const dayNum = parseInt(d, 10);
          if (isNaN(dayNum)) return false;
          const itemWeek = Math.ceil(dayNum / 7);
          return itemWeek === selectedWeekOfMonth;
        }
        case "weekOfYear": {
          if (!selectedWeekOfYear) return true;
          try {
            const itemDate = new Date(+y, +m - 1, +d);
            if (itemDate.getFullYear() !== Number(selectedYear)) return false;
            const getWeekNum = (dt: Date) => {
              const startOfYear = new Date(dt.getFullYear(), 0, 1);
              const diffDays =
                (dt.getTime() - startOfYear.getTime()) / (1000 * 3600 * 24);
              return Math.floor(diffDays / 7) + 1;
            };
            const w = getWeekNum(itemDate);
            return w === selectedWeekOfYear;
          } catch {
            return false;
          }
        }
        case "customRange": {
          try {
            const itemDate = new Date(+y, +m - 1, +d);
            const fromDate = new Date(+fromYear, +fromMonth - 1, +fromDay);
            const toDate = new Date(+toYear, +toMonth - 1, +toDay);
            return itemDate >= fromDate && itemDate <= toDate;
          } catch {
            return false;
          }
        }
        default:
          return true;
      }
    });
    setFilteredItems(newFiltered);
  }, [
    allItems,
    filterMode,
    selectedYear,
    selectedMonth,
    selectedDay,
    selectedWeekOfMonth,
    selectedWeekOfYear,
    fromDay,
    fromMonth,
    fromYear,
    toDay,
    toMonth,
    toYear,
    selectedQuarter,
  ]);

  if (loading) {
    return <p style={{ padding: 20 }}>Loading…</p>;
  }
  if (error) {
    return <p style={{ color: "red", padding: 20 }}>Error: {error}</p>;
  }

  const totalChanges = filteredItems.length;
  const changesByArea: Record<string, number> = {};
  filteredItems.forEach((item) => {
    const area = item.SheetName || "Unknown";
    changesByArea[area] = (changesByArea[area] || 0) + 1;
  });

  return (
    <div className="bg-gray-100 min-h-screen p-6">
      <div className="p-6 space-y-6 bg-white rounded-lg shadow-md">
        {/* FILTER MODES (Horizontal Button Group) */}
        <div className="flex flex-row flex-wrap justify-center items-center gap-3 mb-3">
          <span className="font-semibold mr-4">Filter Mode:</span>
          {filterModes.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterMode(key)}
              className={`px-5 py-2 rounded-lg text-base font-medium transition shadow 
                ${filterMode === key
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-blue-100"
                }`}
              style={{ minWidth: 110 }}
            >
              {label}
            </button>
          ))}
        </div>
        {/* SUBFILTER CONTROLS - centered, below filter mode */}
        <div className="flex flex-row flex-wrap gap-3 justify-center items-center mb-4">
          {/* Year */}
          {(filterMode === "year" ||
            filterMode === "quarter" ||
            filterMode === "month" ||
            filterMode === "day" ||
            filterMode === "weekOfMonth" ||
            filterMode === "weekOfYear") && (
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="border px-3 py-1 rounded"
            >
              {Array.from({ length: 7 }, (_, i) => (2022 + i).toString()).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}

          {/* Quarter */}
          {filterMode === "quarter" && (
            <select
              value={selectedQuarter}
              onChange={e => setSelectedQuarter(e.target.value)}
              className="border px-3 py-1 rounded"
            >
              <option value="1">Q1</option>
              <option value="2">Q2</option>
              <option value="3">Q3</option>
              <option value="4">Q4</option>
            </select>
          )}
          {/* Month */}
          {(filterMode === "month" ||
            filterMode === "day" ||
            filterMode === "weekOfMonth" ) && (
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="border px-3 py-1 rounded"
            >
              {Array.from({ length: 12 }, (_, i) => {
                const monthValue = (i + 1).toString().padStart(2, "0");
                return (
                  <option key={monthValue} value={monthValue}>
                    {new Date(0, i).toLocaleString("en-US", { month: "long" })}
                  </option>
                );
              })}
            </select>
          )}

          {/* Day */}
          {(filterMode === "day") && (
            <select
              value={selectedDay}
              onChange={e => setSelectedDay(e.target.value)}
              className="border px-3 py-1 rounded"
            >
              {Array.from({ length: 31 }, (_, i) => {
                const dayValue = (i + 1).toString().padStart(2, "0");
                return <option key={dayValue} value={dayValue}>{dayValue}</option>;
              })}
            </select>
          )}

          {/* Week of Month */}
          {filterMode === "weekOfMonth" && (
            <select
              value={selectedWeekOfMonth ?? ""}
              onChange={e => setSelectedWeekOfMonth(Number(e.target.value) || null)}
              className="border px-3 py-1 rounded"
            >
              <option value="">All Weeks</option>
              {[1, 2, 3, 4, 5].map(w => (
                <option key={w} value={w}>Week {w}</option>
              ))}
            </select>
          )}

          {/* Week of Year */}
          {filterMode === "weekOfYear" && (
            <select
              value={selectedWeekOfYear ?? ""}
              onChange={e => setSelectedWeekOfYear(Number(e.target.value) || null)}
              className="border px-3 py-1 rounded"
            >
              <option value="">All Weeks</option>
              {Array.from({ length: 52 }, (_, i) => (
                <option key={i + 1} value={i + 1}>Week {i + 1}</option>
              ))}
            </select>
          )}

          {/* Custom Range */}
          {filterMode === "customRange" && (
            <div className="flex flex-row gap-2 items-center">
              <div>
                <label className="block text-xs">From</label>
                <input type="text" value={fromYear} onChange={e => setFromYear(e.target.value)} className="w-14 border px-2 rounded" placeholder="Year" />
                <input type="text" value={fromMonth} onChange={e => setFromMonth(e.target.value)} className="w-10 border px-2 rounded ml-1" placeholder="Mo" />
                <input type="text" value={fromDay} onChange={e => setFromDay(e.target.value)} className="w-10 border px-2 rounded ml-1" placeholder="Day" />
              </div>
              <div>
                <label className="block text-xs">To</label>
                <input type="text" value={toYear} onChange={e => setToYear(e.target.value)} className="w-14 border px-2 rounded" placeholder="Year" />
                <input type="text" value={toMonth} onChange={e => setToMonth(e.target.value)} className="w-10 border px-2 rounded ml-1" placeholder="Mo" />
                <input type="text" value={toDay} onChange={e => setToDay(e.target.value)} className="w-10 border px-2 rounded ml-1" placeholder="Day" />
              </div>
            </div>
          )}
        </div>

        {/* API SOURCE BUTTONS - Card Style, Same as Sidebar/Area Cards */}
        <div className="flex flex-row flex-wrap justify-center gap-6 mb-6">
          {apiTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setSelectedApi(tab.key as any)}
              className={`flex flex-col items-center justify-center w-48 h-49 rounded-xl font-semibold text-lg transition 
                shadow
                ${selectedApi === tab.key
                  ? "bg-yellow-400 text-black shadow-lg"
                  : "bg-white text-black hover:bg-yellow-200"
                }`}
              style={{ minHeight: "120px" }}
            >
              <img src={tab.icon} alt={tab.label} className="w-24 h-24 object-contain mb-2" />
              <span className="text-center leading-tight">{tab.label}</span>
            </button>
          ))}
        </div>
        {/* --- VISUALS --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {/* --- CHANGES Visuals --- */}
          {selectedApi === "changes" && (
            <>
            <div className="bg-white rounded-lg shadow-md p-6 col-span-2">
                <StatsCards
                  totalChanges={totalChanges}
                  changesByArea={changesByArea}
                  areaImages={areaImages}
                />
                {project?.toLowerCase() === "draxlmaeir" && (
     <div className="bg-white rounded-lg shadow-md p-6 col-span-2 min-h-[400px]">
       <DraxlOverview items={filteredItems}/>
     </div>
   )}
              </div>
            </>
          )}

          {/* --- SCRAP Visuals --- */}
          {selectedApi === "scrap" && (
            <div className="bg-white rounded-lg shadow-md p-6 col-span-2">
              <ScrapPieChart items={filteredItems} groupBy="year" />
            </div>
           
    
          )}

          {/* --- CLOSURE PHASE 4 --- */}
          {selectedApi === "closurePhase4" && (
            <>
            <div className="bg-white rounded-lg shadow-md p-6 col-span-2">
           <ChangeStatusSemiPieChart items={filteredItems} />
         </div>
     
  <div className="bg-white rounded-lg shadow-md p-6 col-span-2">
  <ProjectPhase4DaysTable
    projects={config.projects}
    changeItems={allItems}
    phase4TargetsListId={
      (() => {
        const phaseCfg = config.lists.find(l => l.name === "Phase4Targets");
        if (!phaseCfg) {
          // you could render an error component instead of throwing
          throw new Error("Phase4Targets list not found in configuration");
        }
        return phaseCfg.listId;
      })()
    }
    siteId={config.siteId}
    getToken={async () => {
      // writing also requires Manage.All
      const tok = await getAccessToken(msalInstance, ["Sites.Manage.All"]);
      if (!tok) throw new Error("No token");
      return tok;
    }}
  />
</div>
  </>
)}

          {/* --- UNPLANNED DOWNTIME --- */}
          {selectedApi === "unplannedDowntime" && (
            <div className="bg-white rounded-lg shadow-md p-6 col-span-2">
              <h2 className="text-xl font-semibold mb-2">Unplanned Downtime</h2>
              <UnplannedDowntimeChart selectedProject={project?.toLowerCase() || ""}/>
            </div>
          )}

          {/* --- COST PA --- */}
          {selectedApi === "costPA" && (
            <>
             {/* ── TARGET INPUT TABLE ───────────────────── */}
    <div className="bg-white rounded-lg shadow-md p-6 col-span-2">
      <h2 className="text-xl font-semibold mb-2">
        Set Monthly Targets per Project
      </h2>
      <MonthlyTargetTable
        projects={ALL_PROJECTS}
        initialTargets={monthlyTargets}
        onChange={(newMap: Record<string, number[]>) =>
          setMonthlyTargets(newMap)
        }
      />
      {/* Semester picker (only shown when filterMode="semester") */}
      {filterMode === "semester" && (
        <div className="mt-2">
          <label className="mr-2">Semester:</label>
          <select
            value={String(selectedSemester)}
            onChange={e =>
              setSelectedSemester(Number(e.target.value) as 1|2)
            }
            className="border px-2 py-1 rounded"
          >
            <option value="1">H1 (Jan–Jun)</option>
            <option value="2">H2 (Jul–Dec)</option>
          </select>
        </div>
      )}
    </div>

    {/* ── CUMULATIVE ACTUAL vs TARGET ───────────── */}
    <div className="bg-white rounded-lg shadow-md p-6 col-span-2">
      <h2 className="text-xl font-semibold mb-2">
        Cumulative Actual vs. Target
      </h2>
      <ProjectCostWithTargetChart
        data={followCostItems}
        year={Number(selectedYear)}
        monthlyTarget={perBucketTarget}
      />
    </div>
              {/* —————————————————————————————— */}
{/* For *single* projects: time-series */}
<div className="bg-white rounded-lg shadow-md p-6 col-span-2">
  <h2 className="text-xl font-semibold mb-2">Total Nett Value over Time</h2>
  <FollowupCostTimeSeriesChart
    data={followCostItems}
    filterMode={filterMode}
    selectedProject={project!.toLowerCase()}
    selectedYear={selectedYear}
    selectedMonth={selectedMonth}
    selectedDay={selectedDay}
    selectedQuarter={selectedQuarter}
    selectedWeekOfMonth={selectedWeekOfMonth ?? undefined}
    selectedWeekOfYear={selectedWeekOfYear ?? undefined}
    fromYear={fromYear}
    fromMonth={fromMonth}
    fromDay={fromDay}
    toYear={toYear}
    toMonth={toMonth}
    toDay={toDay}
  />
</div>
{/* reasons over time */}
<div className="bg-white rounded-lg shadow-md p-6 col-span-2">
 <FollowupCostByReasonTimeSeriesChart
    data={followCostItems}
    filterMode={filterMode}
    selectedProject={project!.toLowerCase()}
    selectedYear={selectedYear}
    selectedMonth={selectedMonth}
    selectedDay={selectedDay}
    selectedQuarter={selectedQuarter}
    selectedWeekOfMonth={selectedWeekOfMonth ?? undefined}
    selectedWeekOfYear={selectedWeekOfYear ?? undefined}
    fromYear={fromYear}
    fromMonth={fromMonth}
    fromDay={fromDay}
    toYear={toYear}
    toMonth={toMonth}
    toDay={toDay}
 />
 </div>
  {project?.toLowerCase() === "draxlmaeir" && (
    <>
    {/* 1) Total Nett Value (ALL projects) over Time */}
    <div className="bg-white rounded-lg shadow-md p-6 col-span-2">
      <h2 className="text-xl font-semibold mb-2">
        Total Nett Value over Time (All Projects)
      </h2>
      <FollowupCostTimeSeriesChart
        data={followCostItems}
        filterMode={filterMode}
        selectedProject="draxlmaeir"       // <-- this tells it to include everything
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        selectedDay={selectedDay}
        selectedQuarter={selectedQuarter}
        selectedWeekOfMonth={selectedWeekOfMonth ?? undefined}
        selectedWeekOfYear={selectedWeekOfYear ?? undefined}
        fromYear={fromYear}
        fromMonth={fromMonth}
        fromDay={fromDay}
        toYear={toYear}
        toMonth={toMonth}
        toDay={toDay}
      />
    </div>
      {/* 1) Time-series across dates */}
      <div className="bg-white rounded-lg shadow-md p-6 col-span-2">
        <h2 className="text-xl font-semibold mb-2">
          Total Nett Value over Time
        </h2>
      <FollowupCostProjectTimeSeriesChart
    data={followCostItems}
    filterMode={filterMode}
    selectedYear={selectedYear}
    selectedMonth={selectedMonth}
    selectedDay={selectedDay}
    selectedQuarter={selectedQuarter}
    selectedWeekOfMonth={selectedWeekOfMonth ?? undefined}
    selectedWeekOfYear={selectedWeekOfYear ?? undefined}
    fromYear={fromYear}
    fromMonth={fromMonth}
    fromDay={fromDay}
    toYear={toYear}
    toMonth={toMonth}
    toDay={toDay}
  />

      </div>

      {/* 2) Breakdown by each sub-project */}
      <div className="bg-white rounded-lg shadow-md p-6 col-span-2">
        <h2 className="text-xl font-semibold mb-2">
          Total Nett Value per Sub-Project
        </h2>
        <FollowupCostSubProjectChart
          data={followCostItems}
          filterMode={filterMode}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          selectedDay={selectedDay}
          selectedQuarter={selectedQuarter}
          selectedWeekOfMonth={selectedWeekOfMonth  ?? undefined}
          selectedWeekOfYear={selectedWeekOfYear  ?? undefined}
          fromYear={fromYear}
          fromMonth={fromMonth}
          fromDay={fromDay}
          toYear={toYear}
          toMonth={toMonth}
          toDay={toDay}
        />
      </div>

      {/* 3) And finally your "per project × reason" */}
      <div className="bg-white rounded-lg shadow-md p-6 col-span-2">
        <h2 className="text-xl font-semibold mb-2">
          Total Nett Value per Project × Reason
        </h2>
        <FollowupCostByProjectReasonChart
          data={followCostItems}
          filterMode={filterMode}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          selectedDay={selectedDay}
          selectedQuarter={selectedQuarter}
          selectedWeekOfMonth={selectedWeekOfMonth  ?? undefined}
          selectedWeekOfYear={selectedWeekOfYear  ?? undefined}
          fromYear={fromYear}
          fromMonth={fromMonth}
          fromDay={fromDay}
          toYear={toYear}
          toMonth={toMonth}
          toDay={toDay}
        />
      </div>
    </>
  )}
            </>
          )}
{/* --- DRX IDEA --- */}
{selectedApi === "drxIdea" && (
  <>
    <div className="bg-white rounded-lg shadow-md p-6 col-span-2">
      <h2 className="text-xl font-semibold mb-2">
        Detailed DRX Idea Entries
      </h2>
      <DRXEntriesChart />
    </div>
  </>
)}

{/* --- BUDGET --- */}
{selectedApi === "budget" && (
  <>
    <div className="bg-white rounded-lg shadow-md p-6 col-span-2">
      <h2 className="text-xl font-semibold mb-2">
        Detailed Budget Entries
      </h2>
      <BudgetEntriesChart />
    </div>
  </>
)}

        </div>
      </div>
    </div>
  );
};

export default ChangesDashboard;
