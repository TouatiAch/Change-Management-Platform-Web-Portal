import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
// For robust date parsing & formatting:
import { parse, parseISO, isValid, format } from "date-fns";
import Phase4PieCharts from "./phase 4 closure/Phase4PieCharts";

const DEPARTMENTS = [
  { key: "PAV", label: "PaV", endField: "EnddatePAVPhase4" },
  { key: "LOGISTIC", label: "Logistic", endField: "EndDateLogisticPhase4" },
  { key: "QS", label: "QS", endField: "EndDateQSPhase4" },
  { key: "PSCR", label: "PSCR", endField: "EndDatePSCRPhase4" },
];

// --- Robust date parsing for ISO (YYYY-MM-DD), European (DD/MM/YYYY), or fallback ---
function parseDateSafe(str?: string): Date | undefined {
  if (!str) return undefined;

  let d: Date;
  // 1) ISO format: "2025-06-10"
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    d = parseISO(str);

  // 2) European with slashes: "10/06/2025" or "1/6/2025"
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    d = parse(str, "dd/MM/yyyy", new Date());

  // 3) Fallback: let the JS engine try (e.g. "June 10, 2025")
  } else {
    d = new Date(str);
  }

  return isValid(d) ? d : undefined;
}

// --- Business days calculation (excluding Sat/Sun) ---
function calculateBusinessDays(startStr?: string, endStr?: string): number | "" {
  const start = parseDateSafe(startStr);
  const end = parseDateSafe(endStr);
  if (!start || !end || start > end) return "";

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day >= 1 && day <= 5) count++; // Mon–Fri only
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// --- Safe display for dates as DD/MM/YYYY ---
function formatDateSafe(str?: string): string {
  const d = parseDateSafe(str);
  return d ? format(d, "dd/MM/yyyy") : "";
}

// ---- Types ----
interface Project {
  id: string;
  displayName: string;
  mapping: { implementation: string };
}
interface ChangeItem {
  ID: string;
  Carline?: string;
  Processnumber?: string;
  StartdatePhase4?: string;
  EnddatePAVPhase4?: string;
  EndDateLogisticPhase4?: string;
  EndDateQSPhase4?: string;
  EndDatePSCRPhase4?: string;
  processyear?: string;
  processmonth?: string;
  processid?: string;
}
interface TargetItem {
  Project: string;
  Department: string;
  Target: number;
}
interface Props {
  projects: Project[];
  changeItems: ChangeItem[];
  siteId: string;
  phase4TargetsListId?: string;
  getToken: () => Promise<string>;
}

const ProjectPhase4DaysTable: React.FC<Props> = ({
  projects,
  siteId,
  phase4TargetsListId,
  getToken,
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || "");
  const [changeItems, setChangeItems] = useState<ChangeItem[]>([]);
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [loading, setLoading] = useState(false);

  // --- Load target days from SharePoint for all projects/departments ---
  useEffect(() => {
    if (!phase4TargetsListId || !siteId) return;
    (async () => {
      try {
        const token = await getToken();
        const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${phase4TargetsListId}/items?expand=fields&$top=999`;
        const resp = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
        const rows: TargetItem[] = resp.data.value.map((item: any) => ({
          Project: item.fields.Project,
          Department: item.fields.Department,
          Target: Number(item.fields.Target),
        }));
        setTargets(rows);
      } catch {
        setTargets([]);
      }
    })();
  }, [phase4TargetsListId, siteId, getToken]);

  // --- Load implementation list items for selected project ---
  useEffect(() => {
    const proj = projects.find(p => p.id === selectedProjectId);
    if (!proj || !proj.mapping.implementation) {
      setChangeItems([]);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const token = await getToken();
        const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${proj.mapping.implementation}/items?expand=fields&$top=2000`;
        const resp = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
        const rows: ChangeItem[] = resp.data.value.map((it: any) => ({
          ID: it.id,
          Carline: it.fields.Carline,
          Processnumber: it.fields.Processnumber,
          StartdatePhase4: it.fields.StartdatePhase4,
          EnddatePAVPhase4: it.fields.EnddatePAVPhase4,
          EndDateLogisticPhase4: it.fields.EndDateLogisticPhase4,
          EndDateQSPhase4: it.fields.EndDateQSPhase4,
          EndDatePSCRPhase4: it.fields.EndDatePSCRPhase4,
          processyear: it.fields.processyear,
          processmonth: it.fields.processmonth,
          processid: it.fields.processid,
        }));
        setChangeItems(rows);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedProjectId, projects, siteId, getToken]);

  // --- Filters for year/month ---
  const years = useMemo(
    () => Array.from(new Set(changeItems.map(i => i.processyear).filter(Boolean))).sort(),
    [changeItems]
  );
  const months = useMemo(
    () =>
      Array.from(
        new Set(changeItems.map(i => i.processmonth?.padStart(2, "0")).filter(Boolean))
      ).sort(),
    [changeItems]
  );
  const [selectedYear, setSelectedYear] = useState(years[0] || "");
  const [selectedMonth, setSelectedMonth] = useState(months[0] || "");

  useEffect(() => { if (years[0]) setSelectedYear(years[0]); }, [years]);
  useEffect(() => { if (months[0]) setSelectedMonth(months[0]); }, [months]);

  // --- Filter data for year/month ---
  const filteredItems = useMemo(
    () =>
      changeItems.filter(
        i =>
          (!selectedYear || i.processyear === selectedYear) &&
          (!selectedMonth || i.processmonth?.padStart(2, "0") === selectedMonth)
      ),
    [changeItems, selectedYear, selectedMonth]
  );

  return (
    <div className="max-w-7xl mx-auto my-8">
      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div>
          <label>Project:</label>
          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="ml-2 border rounded p-1"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Year:</label>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            className="ml-2 border rounded p-1"
          >
            <option value="">All</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label>Month:</label>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="ml-2 border rounded p-1"
          >
            <option value="">All</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-10 text-center text-gray-400">Loading…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300 rounded">
            <thead>
              <tr className="bg-blue-800 text-white">
                <th className="px-3 py-2 border">Carline</th>
                <th className="px-3 py-2 border">Process Number</th>
                <th className="px-3 py-2 border">Start Date Phase 4</th>
                {DEPARTMENTS.map(dep => (
                  <React.Fragment key={dep.key}>
                    <th className="px-3 py-2 border">{dep.label} End Date </th>
                    <th className="px-3 py-2 border">{dep.label} Working Days</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={3 + DEPARTMENTS.length * 2 + 1} className="text-center py-8 text-gray-400">
                    No data for this selection.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.ID} className="bg-gray-50">
                    <td className="px-3 py-2 border">{item.Carline ?? ""}</td>
                    <td className="px-3 py-2 border">{item.Processnumber ?? ""}</td>
                    <td className="px-3 py-2 border">{formatDateSafe(item.StartdatePhase4)}</td>
                    {DEPARTMENTS.map(dep => {
                      const endDate = (item as any)[dep.endField] as string | undefined;
                      const days = calculateBusinessDays(item.StartdatePhase4, endDate);
                      const proj = projects.find(p => p.id === selectedProjectId);
                      const targetObj = targets.find(
                        t =>
                          (t.Project === proj?.displayName || t.Project === proj?.id) &&
                          t.Department === dep.key
                      );
                      const target = targetObj?.Target;
                      const colorClass =
                        typeof days === "number" && typeof target === "number"
                          ? days <= target
                            ? "text-green-700 font-semibold"
                            : "text-red-600 font-semibold"
                          : "";

                      return (
                        <React.Fragment key={dep.key}>
                          <td className="px-3 py-2 border">{formatDateSafe(endDate)}</td>
                          <td className={`px-3 py-2 border text-center ${colorClass}`}>
                            {days !== "" ? days : "-"}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <Phase4PieCharts
      changeItems={filteredItems}
      targets={targets}
      projects={projects}
      selectedProjectId={selectedProjectId /* or omit to include ALL projects */}
    />
        </div>
      )}
    </div>
  );
};

export default ProjectPhase4DaysTable;
