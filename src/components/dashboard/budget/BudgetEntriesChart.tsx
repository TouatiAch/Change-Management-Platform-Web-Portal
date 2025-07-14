// src/components/dashboard/budget/BudgetEntriesChart.tsx
import React, { useState, useEffect, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import axios from "axios";

import { getConfig }      from "../../../services/configService";
import { getAccessToken } from "../../../auth/getToken";
import { msalInstance }   from "../../../auth/msalInstance";

export interface BudgetKPIItem {
  ID: string;
  year: string;                    // e.g. "2024"
  Month?: string;                  // "1"–"12"
  Budgetdepartment?: number;       // actual
  Budgetdepartmentplanified?: number; // planned
}

type FilterMode = "year" | "quarter" | "month" | "customRange";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// monthName("1") → "January"
const monthName = (m?: string) => {
  const idx = parseInt(m || "", 10) - 1;
  return MONTH_NAMES[idx] || "";
};

// labels for every month between start and end inclusive
function monthRangeLabels(start: Date, end: Date): string[] {
  const labels: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth());
  while (cur <= end) {
    labels.push(`${MONTH_NAMES[cur.getMonth()]} ${cur.getFullYear()}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return labels;
}

const BudgetEntriesChart: React.FC = () => {
  const { siteId, lists } = getConfig();
  const budgetsCfg = lists.find(l => l.name.toLowerCase() === "budgets");
  const listId = budgetsCfg?.listId;

  const [records, setRecords] = useState<BudgetKPIItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>("year");

  const now = new Date();
  const defaultYear    = now.getFullYear().toString();
  const defaultMonth   = String(now.getMonth() + 1);
  const defaultQuarter = Math.ceil((now.getMonth()+1)/3).toString();

  const [selectedYear,    setSelectedYear]    = useState(defaultYear);
  const [selectedMonth,   setSelectedMonth]   = useState(defaultMonth);
  const [selectedQuarter, setSelectedQuarter] = useState(defaultQuarter);
  const [fromYear,  setFromYear]  = useState(defaultYear);
  const [fromMonth, setFromMonth] = useState(defaultMonth);
  const [toYear,    setToYear]    = useState(defaultYear);
  const [toMonth,   setToMonth]   = useState(defaultMonth);

  // ── fetch on mount ───────────────────────────────
  useEffect(() => {
    if (!siteId || !listId) {
      console.error("BudgetEntriesChart: missing siteId or listId");
      setLoading(false);
      return;
    }
    let cancel = false;
    (async () => {
      setLoading(true);
      const token = await getAccessToken(msalInstance, ["Sites.Read.All"]);
      if (!token) throw new Error("No Graph token");

      let next = `https://graph.microsoft.com/v1.0/sites/${siteId}` +
                 `/lists/${listId}/items?expand=fields&$top=2000`;
      const out: BudgetKPIItem[] = [];

      while (next) {
        const resp = await axios.get(next, {
          headers: { Authorization: `Bearer ${token}` },
        });
        resp.data.value.forEach((it: any) => {
          out.push({
            ID:                         it.id,
            year:                       it.fields.year,
            Month:                      it.fields.Month,
            Budgetdepartment:           Number(it.fields.Budget)          || 0,
            Budgetdepartmentplanified:  Number(it.fields.PlanifiedBudget) || 0,
          });
        });
        next = resp.data["@odata.nextLink"] || "";
      }

      if (!cancel) setRecords(out);
      setLoading(false);
    })().catch(err => {
      console.error(err);
      if (!cancel) setLoading(false);
    });
    return () => { cancel = true; };
  }, [siteId, listId]);

  // ── aggregate ─────────────────────────────────────
  const { labels, actuals, plans } = useMemo(() => {
    const labs: string[] = [];
    const acts: number[] = [];
    const pls: number[] = [];

    // filters
    const byYear = (r: BudgetKPIItem) => r.year === selectedYear;
    const byMonth = (r: BudgetKPIItem) =>
      r.year === selectedYear &&
      parseInt(r.Month||"0",10) === parseInt(selectedMonth,10);
    const byQuarter = (r: BudgetKPIItem) => {
      if (r.year !== selectedYear) return false;
      const m = parseInt(r.Month||"0",10);
      return Math.ceil(m/3) === parseInt(selectedQuarter,10);
    };

    if (filterMode === "year") {
      // one bar per month
      MONTH_NAMES.forEach(mName => {
        const lbl = `${mName} ${selectedYear}`;
        labs.push(lbl);
        const sumA = records
          .filter(r => r.year===selectedYear && monthName(r.Month)===mName)
          .reduce((a,r)=> a + (r.Budgetdepartment||0), 0);
        const sumP = records
          .filter(r => r.year===selectedYear && monthName(r.Month)===mName)
          .reduce((a,r)=> a + (r.Budgetdepartmentplanified||0), 0);
        acts.push(sumA);
        pls.push(sumP);
      });
    }
    else if (filterMode === "quarter") {
      const lbl = `Q${selectedQuarter} ${selectedYear}`;
      labs.push(lbl);
      const sumA = records.filter(byQuarter)
        .reduce((a,r)=> a + (r.Budgetdepartment||0), 0);
      const sumP = records.filter(byQuarter)
        .reduce((a,r)=> a + (r.Budgetdepartmentplanified||0), 0);
      acts.push(sumA);
      pls.push(sumP);
    }
    else if (filterMode === "month") {
      const mName = monthName(selectedMonth);
      const lbl = `${mName} ${selectedYear}`;
      labs.push(lbl);
      const sumA = records.filter(byMonth)
        .reduce((a,r)=> a + (r.Budgetdepartment||0), 0);
      const sumP = records.filter(byMonth)
        .reduce((a,r)=> a + (r.Budgetdepartmentplanified||0), 0);
      acts.push(sumA);
      pls.push(sumP);
    }
    else /* customRange */ {
      const start = new Date(+fromYear, +fromMonth-1);
      const end   = new Date(+toYear,   +toMonth-1);
      monthRangeLabels(start,end).forEach(lbl => {
        labs.push(lbl);
        const [mName,y] = lbl.split(" ");
        const sumA = records
          .filter(r=> r.year===y && monthName(r.Month)===mName)
          .reduce((a,r)=> a + (r.Budgetdepartment||0), 0);
        const sumP = records
          .filter(r=> r.year===y && monthName(r.Month)===mName)
          .reduce((a,r)=> a + (r.Budgetdepartmentplanified||0),0);
        acts.push(sumA);
        pls.push(sumP);
      });
    }

    return { labels: labs, actuals: acts, plans: pls };
  }, [
    records, filterMode,
    selectedYear, selectedMonth, selectedQuarter,
    fromYear, fromMonth, toYear, toMonth,
  ]);

  if (loading) {
    return <div className="p-4 text-gray-500">Loading budgets…</div>;
  }
  if (!records.length) {
    return <div className="p-4 text-gray-500">No budget entries available.</div>;
  }

  const modeOptions: { key: FilterMode; label: string }[] = [
    { key: "year",        label: "By Year"      },
    { key: "quarter",     label: "By Quarter"   },
    { key: "month",       label: "By Month"     },
    { key: "customRange", label: "Custom Range" },
  ];

  return (
    <div>
      {/* Filter toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {modeOptions.map(({key,label}) => (
          <button
            key={key}
            onClick={()=>setFilterMode(key)}
            style={{
              padding: "6px 12px",
              background: key===filterMode ? "#007acc":"#eee",
              color:     key===filterMode ? "#fff":"#000",
              border: "none", borderRadius: 4,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sub-filters */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        {filterMode==="year" && (
          <label>Year:&nbsp;
            <input
              type="number"
              value={selectedYear}
              onChange={e=>setSelectedYear(e.target.value)}
              style={{width:80}}
            />
          </label>
        )}
        {filterMode==="quarter" && (
          <>
            <label>Year:&nbsp;
              <input
                type="number"
                value={selectedYear}
                onChange={e=>setSelectedYear(e.target.value)}
                style={{width:80}}
              />
            </label>
            <label>Quarter:&nbsp;
              <select
                value={selectedQuarter}
                onChange={e=>setSelectedQuarter(e.target.value)}
              >
                {[1,2,3,4].map(q=>(
                  <option key={q} value={q.toString()}>Q{q}</option>
                ))}
              </select>
            </label>
          </>
        )}
        {filterMode==="month" && (
          <>
            <label>Year:&nbsp;
              <input
                type="number"
                value={selectedYear}
                onChange={e=>setSelectedYear(e.target.value)}
                style={{width:80}}
              />
            </label>
            <label>Month:&nbsp;
              <select
                value={selectedMonth}
                onChange={e=>setSelectedMonth(e.target.value)}
              >
                {MONTH_NAMES.map((m,i)=>(
                  <option key={m} value={(i+1).toString()}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {filterMode==="customRange" && (
          <>
            <label>From:&nbsp;
              <input
                type="number"
                value={fromYear}
                onChange={e=>setFromYear(e.target.value)}
                style={{width:80}}
              />
              <select
                value={fromMonth}
                onChange={e=>setFromMonth(e.target.value)}
              >
                {MONTH_NAMES.map((m,i)=>(
                  <option key={m} value={(i+1).toString()}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label>To:&nbsp;
              <input
                type="number"
                value={toYear}
                onChange={e=>setToYear(e.target.value)}
                style={{width:80}}
              />
              <select
                value={toMonth}
                onChange={e=>setToMonth(e.target.value)}
              >
                {MONTH_NAMES.map((m,i)=>(
                  <option key={m} value={(i+1).toString()}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>

      {/* Chart */}
      <ReactECharts
        option={{
          title:   { text: "Budget: Planned vs Actual", left: "center" },
          tooltip: { trigger: "axis" },
          legend:  { top: 30, data: ["Planned","Actual"] },
          grid:    { bottom: 100 },
          xAxis:   {
            type: "category",
            data: labels,
            axisLabel: { rotate: 45, interval: 0, fontSize: 10 },
          },
          yAxis: { type: "value" },
          series: [
            { name: "Planned", type: "bar", data: plans,   itemStyle: { color: "#3B82F6" } },
            { name: "Actual",  type: "bar", data: actuals, itemStyle: { color: "#E53935" } },
          ],
        }}
        style={{ width: "100%", height: 450 }}
      />
    </div>
  );
};

export default BudgetEntriesChart;
