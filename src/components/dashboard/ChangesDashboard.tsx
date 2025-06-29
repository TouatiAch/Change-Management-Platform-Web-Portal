import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import StatsCards from "./StatsCards";
import { OpenClosedPieChart } from "./OpenClosedPieChart";
import { ScrapPieChart } from "./ScrapPieChart";
import { SubAreaPieChart } from "./SubAreaPieChart";
import { getAccessToken } from "../../auth/getToken";
import { msalInstance } from "../../auth/msalInstance";
import { UnplannedDowntimeChart } from "./UnplannedDowntimeChart";
import FilterControls from "./FilterControls";
import { DRXIdeaProgressChart } from "./DRXIdeaProgressChart";
import { BudgetDepartmentChart } from "./BudgetDepartmentChart";
import { BudgetEntriesChart } from "./BudgetEntriesChart";
import { DRXEntriesChart } from "./DRXEntriesChart";
import { FollowupCostByAreaChart } from "./FollowupCostByAreaChart";
import { FollowupCostByReasonChart } from "./FollowupCostByReasonChart";
import { FollowupCostCombinedChart } from "./FollowupCostCombinedChart";

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
  monthlyListId: string;
  followCostListId: string;
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
  processyear?: string;
  processmonth?: string;
  processday?: string;
}
interface MonthlyKPIItem {
  ID: string;
  year: string;
  Monthid: string; 
  Project?: string;
  downtime?: number;
  rateofdowntime?: number;
  Targetdowntime?: number;
  seuildinterventiondowntime?: number;
  DRXIdeasubmittedIdea?: number;
  DRXIdeasubmittedIdeaGoal?: number; 
  Budgetdepartment?: number;
  Budgetdepartmentplanified?: number;
}
interface FollowCostKPIItem {
  ID: string;
  Project: string;
  Area: string;
  Followupcost_x002f_BudgetPA: number;
  InitiationReasons: string;
  BucketID: string;
  Date: string;
  BucketResponsible: string;
  Postname_x002f_ID: string;
}

type FilterMode =
  | "year"
  | "quarter"
  | "month"
  | "day"
  | "weekOfMonth"
  | "weekOfYear"
  | "customRange";

export const ChangesDashboard: React.FC = () => {
  const { project } = useParams<{ project: string }>();

  // Items & error/loading states
  const [allItems, setAllItems] = useState<ChangeItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<ChangeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [allMonthlyKPIs, setAllMonthlyKPIs] = useState<MonthlyKPIItem[]>([]);
const [filteredMonthlyKPIs, setFilteredMonthlyKPIs] = useState<MonthlyKPIItem[]>([]);
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

  // State for week-of-month/week-of-year
  const [selectedWeekOfMonth, setSelectedWeekOfMonth] = useState<number | null>(null);
  const [selectedWeekOfYear, setSelectedWeekOfYear] = useState<number | null>(null);

  // State for custom range
  const [fromDay, setFromDay] = useState("01");
  const [fromMonth, setFromMonth] = useState("01");
  const [fromYear, setFromYear] = useState("2025");
  const [toDay, setToDay] = useState("31");
  const [toMonth, setToMonth] = useState("12");
  const [toYear, setToYear] = useState("2025");

  const [followCostItems, setFollowCostItems] = useState<FollowCostKPIItem[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      try {
        const token = await getAccessToken(msalInstance, ["User.Read"]);
        if (!token) throw new Error("No valid token found. Please log in again.");

        const rawConfig = localStorage.getItem("cmConfigLists");
        if (!rawConfig) throw new Error("No config in localStorage (cmConfigLists).");

        let config: cmConfigLists;
        try {
          config = JSON.parse(rawConfig);
        } catch {
          throw new Error("Failed to parse cmConfigLists from localStorage.");
        }
        if (!config.siteId) {
          throw new Error("No siteId in config.");
        }
        const siteId = config.siteId;
        const accumulated: ChangeItem[] = [];
        const fetchListItems = async (listId: string) => {
          let nextLink = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?expand=fields&$top=2000`;
          while (nextLink) {
            const resp = await axios.get(nextLink, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!Array.isArray(resp.data.value)) {
              throw new Error("Missing array at resp.data.value from SharePoint.");
            }
            const pageItems = resp.data.value.map((it: any) => ({
              ID: it.id,
              SheetName: it.fields.SheetName,
              Constructedspace: it.fields.Constructedspace,
              Status: it.fields.Status,
              EnddatePhase4: it.fields.EnddatePhase4,
              EnddatePAVPhase4: it.fields.EnddatePAVPhase4,
              EnddatePhase8: it.fields.EnddatePhase8,
              processyear: it.fields.processyear,
              processmonth: it.fields.processmonth,
              processday: it.fields.processday,
            })) as ChangeItem[];
            accumulated.push(...pageItems);
            nextLink = resp.data["@odata.nextLink"] || "";
          }
        };
        if (project?.toLowerCase() === "draxlmaeir") {
          const validProjects = config.projects.filter(
            (p) => p.mapping.implementation
          );
          if (!validProjects.length) {
            throw new Error("No valid subprojects found for 'draxlmaeir'.");
          }
          for (const sub of validProjects) {
            const listId = sub.mapping.implementation;
            if (listId) {
              await fetchListItems(listId);
            }
          }
        } else {
          // Single project
          const found = config.projects.find(
            (p) => p.id.toLowerCase() === project?.toLowerCase()
          );
          if (!found) {
            throw new Error(`No project with id='${project}' found in config.`);
          }
          const listId = found.mapping.implementation;
          if (!listId) {
            throw new Error(
              `Project '${found.displayName}' missing implementation list.`
            );
          }
          await fetchListItems(listId);
        }
        setAllItems(accumulated);
      // 2) Fetch from monthlyListId (if it exists)
      if (!config.monthlyListId) {
        console.warn("No monthlyListId in config. Skipping monthly KPI fetch.");
      } else {
        const kpiAccumulated: MonthlyKPIItem[] = [];
        const fetchMonthlyKPIs = async (listId: string) => {
          let nextLink = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?expand=fields&$top=2000`;
          while (nextLink) {
            const resp = await axios.get(nextLink, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!Array.isArray(resp.data.value)) {
              throw new Error("Missing array at resp.data.value from SharePoint.");
            }
const pageItems = resp.data.value.map((it: any) => {
  return {
  ID: it.id,
  year: it.fields.year,
  Monthid: it.fields.Monthid,
  Project: it.fields.Project,
  downtime: it.fields.downtime,
  rateofdowntime: it.fields.rateofdowntime,
  Targetdowntime: it.fields.Targetdowntime,
  seuildinterventiondowntime: it.fields.seuildinterventiondowntime,
  DRXIdeasubmittedIdea: it.fields.DRXIdeasubmittedIdea, 
  DRXIdeasubmittedIdeaGoal: it.fields.DRXIdeasubmittedIdeaGoal, 
  Budgetdepartment: it.fields.Budgetdepartment,
  Budgetdepartmentplanified: it.fields.Budgetdepartmentplanified,
};
});
            kpiAccumulated.push(...pageItems);
            nextLink = resp.data["@odata.nextLink"] || "";
          }
        };
        await fetchMonthlyKPIs(config.monthlyListId);
        setAllMonthlyKPIs(kpiAccumulated);

        if (config.followCostListId) {
  const followCostAccumulated: FollowCostKPIItem[] = [];
  const fetchFollowCostKPIs = async (listId: string) => {
    let nextLink = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?expand=fields&$top=2000`;
    while (nextLink) {
      const resp = await axios.get(nextLink, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const pageItems = resp.data.value.map((it: any) => ({
        ID: it.id,
        Project: it.fields.Project,
        Area: it.fields.Area,
        Followupcost_x002f_BudgetPA: it.fields.Followupcost_x002f_BudgetPA,
        InitiationReasons: it.fields.InitiationReasons,
        BucketID: it.fields.BucketID,
        Date: it.fields.Date,
        BucketResponsible: it.fields.BucketResponsible,
        Postname_x002f_ID: it.fields.Postname_x002f_ID,
      }));
      followCostAccumulated.push(...pageItems);
      nextLink = resp.data["@odata.nextLink"] || "";
    }
  };
  await fetchFollowCostKPIs(config.followCostListId);
  setFollowCostItems(followCostAccumulated);
}

      }
    } catch (err: any) {
      console.error("Error:", err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  })();
}, [project]);
useEffect(() => {
  if (!allMonthlyKPIs.length) {
    setFilteredMonthlyKPIs([]);
    return;
  }
  const newFiltered = allMonthlyKPIs.filter((item) => {
    const itemMonthNum = parseInt(item.Monthid, 10);
if (isNaN(itemMonthNum)) return false;
    if (itemMonthNum < 1) return false;

    switch (filterMode) {
      case "month":
        return item.year === selectedYear && itemMonthNum === parseInt(selectedMonth);

      case "quarter": {
        if (item.year !== selectedYear) return false;
        const q = parseInt(selectedQuarter, 10);
        const minM = (q - 1) * 3 + 1;
        const maxM = q * 3;
        return itemMonthNum >= minM && itemMonthNum <= maxM;
      }
      default:
        return true;
    }
  });
  setFilteredMonthlyKPIs(newFiltered);
}, [
  allMonthlyKPIs,
  filterMode,
  selectedYear,
  selectedMonth,
  selectedQuarter,
]);
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
            // Ensure the item year matches the user’s chosen year
            if (itemDate.getFullYear() !== Number(selectedYear)) return false;
            // Basic function to get week-of-year
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
        {/* Dashboard Title */}
        <h1 className="text-2xl font-bold text-gray-900">
          {project?.toLowerCase() === "draxlmaeir"
            ? "Changes Dashboard – Combined – Project: draxlmaeir"
            : `Changes Dashboard – Implementation – Project: ${project}`}
        </h1>

        {/* Filter Mode Selector */}
        <div className="flex space-x-4 items-center mb-4">
          <div>
            <FilterControls
  filterMode={filterMode}
  setFilterMode={setFilterMode}
  selectedYear={selectedYear}
  setSelectedYear={setSelectedYear}
  selectedMonth={selectedMonth}
  setSelectedMonth={setSelectedMonth}
  selectedQuarter={selectedQuarter}
  setSelectedQuarter={setSelectedQuarter}
  selectedDay={selectedDay}
  setSelectedDay={setSelectedDay}
  selectedWeekOfMonth={selectedWeekOfMonth}
  setSelectedWeekOfMonth={setSelectedWeekOfMonth}
  selectedWeekOfYear={selectedWeekOfYear}
  setSelectedWeekOfYear={setSelectedWeekOfYear}
  fromDay={fromDay}
  fromMonth={fromMonth}
  fromYear={fromYear}
  toDay={toDay}
  toMonth={toMonth}
  toYear={toYear}
  setFromDay={setFromDay}
  setFromMonth={setFromMonth}
  setFromYear={setFromYear}
  setToDay={setToDay}
  setToMonth={setToMonth}
  setToYear={setToYear}
/>
          </div>         
        </div>
        {/* Stats Summary */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <StatsCards totalChanges={totalChanges} changesByArea={changesByArea} />
        </div>

        {/* Visuals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <SubAreaPieChart items={filteredItems} />
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <OpenClosedPieChart items={filteredItems} type="phase4" />
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <OpenClosedPieChart items={filteredItems} type="pav" />
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <OpenClosedPieChart items={filteredItems} type="phase8" />
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <ScrapPieChart items={filteredItems} groupBy="year" />
          </div>
          {/*  New chart for unplanned downtime */}

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-2">Unplanned Downtime</h2>
          <UnplannedDowntimeChart data={filteredMonthlyKPIs} />
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
  <h2 className="text-xl font-semibold mb-2">DRX Idea Progress</h2>
  <DRXIdeaProgressChart
    data={filteredMonthlyKPIs}
    filterMode={filterMode as "month" | "quarter" | "year"}
  />
</div>
<div className="bg-white rounded-lg shadow-md p-6">
  <h2 className="text-xl font-semibold mb-2">Budget Department</h2>
  <BudgetDepartmentChart
    data={filteredMonthlyKPIs}
    filterMode={filterMode as "month" | "quarter" | "year"}
  />
</div>
<div className="bg-white rounded-lg shadow-md p-6">
  <h2 className="text-xl font-semibold mb-2">Detailed Budget Entries</h2>
  <BudgetEntriesChart
    data={filteredMonthlyKPIs}
    filterMode={filterMode as "month" | "quarter" | "year"}
  />
</div>
<div className="bg-white rounded-lg shadow-md p-6">
  <h2 className="text-xl font-semibold mb-2">Detailed DRX Idea Entries</h2>
  <DRXEntriesChart
    data={filteredMonthlyKPIs}
    filterMode={filterMode as "month" | "quarter" | "year"}
  />
</div>
<FollowupCostByAreaChart
  data={followCostItems}
  filterMode={filterMode}
  selectedYear={selectedYear}
  selectedMonth={selectedMonth}
  selectedDay={selectedDay}
  selectedQuarter={selectedQuarter}
  selectedWeekOfMonth={selectedWeekOfMonth ?? undefined}
  selectedWeekOfYear={selectedWeekOfYear ?? undefined}
  selectedProject={project?.toLowerCase() || ""}
/>
<div className="bg-white rounded-lg shadow-md p-6">
  <h2 className="text-xl font-semibold mb-2">Coût suivi / Budget PA par Raison de l’initiation</h2>
  <FollowupCostByReasonChart
    data={followCostItems}
    filterMode={filterMode}
    selectedYear={selectedYear}
    selectedMonth={selectedMonth}
    selectedDay={selectedDay}
    selectedQuarter={selectedQuarter}
    selectedWeekOfMonth={selectedWeekOfMonth ?? undefined}
    selectedWeekOfYear={selectedWeekOfYear ?? undefined}
    selectedProject={project?.toLowerCase() || ""}
  />
</div>
<div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-md p-6">
  <h2 className="text-xl font-semibold mb-2">Coût suivi / Budget PA par Raison et Zone</h2>
  <FollowupCostCombinedChart
    data={followCostItems}
    filterMode={filterMode}
    selectedYear={selectedYear}
    selectedMonth={selectedMonth}
    selectedDay={selectedDay}
    selectedQuarter={selectedQuarter}
    selectedWeekOfMonth={selectedWeekOfMonth ?? undefined}
    selectedWeekOfYear={selectedWeekOfYear ?? undefined}
    selectedProject={project?.toLowerCase() || ""}
  />
</div>

        </div>
      </div>
    </div>
  );
};
