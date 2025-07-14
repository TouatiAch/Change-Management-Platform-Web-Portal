// src/components/dashboard/budget/BudgetEntriesChart.tsx
import React, { useState, useEffect, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import axios from "axios";

import { getConfig }      from "../../../services/configService";
import { getAccessToken } from "../../../auth/getToken";
import { msalInstance }   from "../../../auth/msalInstance";

export interface BudgetKPIItem {
  ID: string;
  year: string;                     // e.g. "2024"
  Month?: string;                   // "1"–"12"
  Quarter?: string;                 // "1"–"4"
  Budgetdepartment?: number;        // actual
  Budgetdepartmentplanified?: number; // planned
}

// <-- extended modes
type FilterMode =
  | "year"        // 12 months of one year
  | "allQuarters" // Q1–Q4
  | "hy"          // HY1 / HY2
  | "quarter"     // single quarter
  | "month"       // single month
  | "customRange" // arbitrary months
  | "yearRange";  // arbitrary years

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const monthName = (m?: string) => {
  const idx = parseInt(m||"",10) - 1;
  return MONTH_NAMES[idx] || "";
};
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

  // ── filter state ───────────────────────────
  const now = new Date();
  const defaultYear    = now.getFullYear().toString();
  const defaultMonth   = String(now.getMonth()+1);
  const defaultQuarter = Math.ceil((now.getMonth()+1)/3).toString();

  const [filterMode,      setFilterMode]      = useState<FilterMode>("year");
  const [selectedYear,    setSelectedYear]    = useState(defaultYear);
  const [selectedMonth,   setSelectedMonth]   = useState(defaultMonth);
  const [selectedQuarter, setSelectedQuarter] = useState(defaultQuarter);
  const [fromYear,        setFromYear]        = useState(defaultYear);
  const [toYear,          setToYear]          = useState(defaultYear);
  const [fromMonth,       setFromMonth]       = useState(defaultMonth);
  const [toMonth,         setToMonth]         = useState(defaultMonth);

  // ── fetch on mount ─────────────────────────
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
            ID:                        it.id,
            year:                      it.fields.year,
            Month:                     it.fields.Month,
            Quarter:                   it.fields.Quarter,
            Budgetdepartment:          Number(it.fields.Budget)          || 0,
            Budgetdepartmentplanified: Number(it.fields.PlanifiedBudget) || 0,
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

  // ── aggregate ───────────────────────────────
  const { labels, actuals, plans } = useMemo(() => {
    const labs: string[] = [];
    const acts: number[] = [];
    const pls:  number[] = [];

    // helpers
    const recsForYear = (year: string) =>
      records.filter(r => r.year === year);

    const recsForQuarter = (year: string, q: number) =>
      records.filter(r => {
        if (r.year !== year) return false;
        if (r.Quarter) {
          return parseInt(r.Quarter,10) === q;
        }
        const m = parseInt(r.Month||"0",10);
        return Math.ceil(m/3) === q;
      });

    if (filterMode === "year") {
      // 12 months
      MONTH_NAMES.forEach(mName => {
        labs.push(`${mName} ${selectedYear}`);
        const recs = records.filter(r =>
          r.year === selectedYear && monthName(r.Month) === mName
        );
        acts.push(recs.reduce((a,r)=>a+(r.Budgetdepartment||0),0));
        pls.push(recs.reduce((a,r)=>a+(r.Budgetdepartmentplanified||0),0));
      });
    }
    else if (filterMode === "allQuarters") {
      // Q1–Q4
      for (let q = 1; q <= 4; q++) {
        labs.push(`Q${q} ${selectedYear}`);
        const recs = recsForQuarter(selectedYear, q);
        acts.push(recs.reduce((a,r)=>a+(r.Budgetdepartment||0),0));
        pls.push(recs.reduce((a,r)=>a+(r.Budgetdepartmentplanified||0),0));
      }
    }
    else if (filterMode === "hy") {
      // HY1 = Q1+Q2, HY2 = Q3+Q4
      [1,2].forEach(h => {
        labs.push(`HY${h} ${selectedYear}`);
        const recs = recsForQuarter(selectedYear, h*2-1)
                   .concat(recsForQuarter(selectedYear, h*2));
        acts.push(recs.reduce((a,r)=>a+(r.Budgetdepartment||0),0));
        pls.push(recs.reduce((a,r)=>a+(r.Budgetdepartmentplanified||0),0));
      });
    }
    else if (filterMode === "quarter") {
      // single quarter
      const qNum = parseInt(selectedQuarter,10);
      labs.push(`Q${qNum} ${selectedYear}`);
      const recs = recsForQuarter(selectedYear, qNum);
      acts.push(recs.reduce((a,r)=>a+(r.Budgetdepartment||0),0));
      pls.push(recs.reduce((a,r)=>a+(r.Budgetdepartmentplanified||0),0));
    }
    else if (filterMode === "month") {
      // single month
      const mName = monthName(selectedMonth);
      labs.push(`${mName} ${selectedYear}`);
      const recs = records.filter(r =>
        r.year===selectedYear && monthName(r.Month)===mName
      );
      acts.push(recs.reduce((a,r)=>a+(r.Budgetdepartment||0),0));
      pls.push(recs.reduce((a,r)=>a+(r.Budgetdepartmentplanified||0),0));
    }
    else if (filterMode === "customRange") {
      // arbitrary months
      const start = new Date(+fromYear, +fromMonth-1);
      const end   = new Date(+toYear,   +toMonth-1);
      monthRangeLabels(start,end).forEach(lbl => {
        labs.push(lbl);
        const [mName,y] = lbl.split(" ");
        const recs = records.filter(r=>
          r.year===y && monthName(r.Month)===mName
        );
        acts.push(recs.reduce((a,r)=>a+(r.Budgetdepartment||0),0));
        pls.push(recs.reduce((a,r)=>a+(r.Budgetdepartmentplanified||0),0));
      });
    }
    else /* yearRange */ {
      // arbitrary years
      const start = parseInt(fromYear,10);
      const end   = parseInt(toYear,  10);
      for (let y = start; y <= end; y++) {
        const yStr = y.toString();
        labs.push(yStr);
        const recs = recsForYear(yStr);
        acts.push(recs.reduce((a,r)=>a+(r.Budgetdepartment||0),0));
        pls.push(recs.reduce((a,r)=>a+(r.Budgetdepartmentplanified||0),0));
      }
    }

    return { labels: labs, actuals: acts, plans: pls };
  }, [
    records,
    filterMode,
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
    { key: "year",        label: "By Year (12 mo)" },
    { key: "allQuarters", label: "All Quarters"    },
    { key: "hy",          label: "HY (HY1/HY2)"    },
    { key: "quarter",     label: "One Quarter"     },
    { key: "month",       label: "By Month"        },
    { key: "customRange", label: "Custom Range"    },
    { key: "yearRange",   label: "Yearly Range"    },
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
              border:"none", borderRadius:4
            }}
          >{label}</button>
        ))}
      </div>

      {/* Sub‐filters */}
      <div style={{ display:"flex", gap:16, marginBottom:20, flexWrap:"wrap" }}>
        {["year","allQuarters","hy","quarter"].includes(filterMode) && (
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
                  <option key={m} value={(i+1).toString()}>{m}</option>
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
                  <option key={m} value={(i+1).toString()}>{m}</option>
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
                  <option key={m} value={(i+1).toString()}>{m}</option>
                ))}
              </select>
            </label>
          </>
        )}

        {filterMode==="yearRange" && (
          <>
            <label>From Year:&nbsp;
              <input
                type="number"
                value={fromYear}
                onChange={e=>setFromYear(e.target.value)}
                style={{width:80}}
              />
            </label>
            <label>To Year:&nbsp;
              <input
                type="number"
                value={toYear}
                onChange={e=>setToYear(e.target.value)}
                style={{width:80}}
              />
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
            axisLabel: { rotate:45, interval:0, fontSize:10 },
          },
          yAxis: { type: "value" },
          series: [
            {
         name: "Planned",
         type: "bar",
         data: plans,
         barWidth: "25%",             // ← narrower bars
         label: {
           show: true,
           position: "top",
           formatter: "{c}",
           backgroundColor: "#fff",
           borderColor: "#aaa",
           borderWidth: 1,
           borderRadius: 8,
           padding: [4, 8],
           color: "#333",
           shadowBlur: 4,
           shadowColor: "rgba(0,0,0,0.1)",
         }
       },
       {
         name: "Actual",
         type: "bar",
         data: actuals,
         barWidth: "25%",
         label: {
           show: true,
           position: "top",
           formatter: "{c}",
           backgroundColor: "#fff",
           borderColor: "#aaa",
           borderWidth: 1,
           borderRadius: 8,
           padding: [4, 8],
           color: "#333",
           shadowBlur: 4,
           shadowColor: "rgba(0,0,0,0.1)",
         }
       }
          ],
        }}
        style={{ width: "100%", height: 450 }}
      />
    </div>
  );
};

export default BudgetEntriesChart;
