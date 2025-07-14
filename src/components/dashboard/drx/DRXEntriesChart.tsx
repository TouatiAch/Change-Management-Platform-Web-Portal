// src/components/dashboard/drx/DRXEntriesChart.tsx
import React, { useState, useEffect, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import axios from "axios";

import { getConfig }      from "../../../services/configService";
import { getAccessToken } from "../../../auth/getToken";
import { msalInstance }   from "../../../auth/msalInstance";

export interface DRXItem {
  ID: string;
  year: string;                 // "2024"
  Month?: string;               // "1"–"12"
  DRXIdeasubmittedIdea?: number;
  DRXIdeasubmittedIdeaGoal?: number;
}

type FilterMode = "year" | "quarter" | "month" | "customRange";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const monthName = (numStr?: string) => {
  const idx = parseInt(numStr || "", 10) - 1;
  return MONTH_NAMES[idx] || "";
};

// return labels like ["Jan 2024", "Feb 2024", …]
function monthRangeLabels(start: Date, end: Date): string[] {
  const labels: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth());
  while (cur <= end) {
    labels.push(`${MONTH_NAMES[cur.getMonth()]} ${cur.getFullYear()}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return labels;
}

const DRXEntriesChart: React.FC = () => {
  const { siteId, lists } = getConfig();
  const drxCfg = lists.find(l => l.name.toLowerCase() === "drx");
  const listId = drxCfg?.listId;

  const [records, setRecords] = useState<DRXItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ── filter state ───────────────────────────
  const now = new Date();
  const defaultYear    = now.getFullYear().toString();
  const defaultMonth   = String(now.getMonth()+1);
  const defaultQuarter = Math.ceil((now.getMonth()+1)/3).toString();

  const [filterMode, setFilterMode] = useState<FilterMode>("year");
  const [selectedYear,    setSelectedYear]    = useState(defaultYear);
  const [selectedMonth,   setSelectedMonth]   = useState(defaultMonth);
  const [selectedQuarter, setSelectedQuarter] = useState(defaultQuarter);
  const [fromYear,  setFromYear]  = useState(defaultYear);
  const [fromMonth, setFromMonth] = useState(defaultMonth);
  const [toYear,    setToYear]    = useState(defaultYear);
  const [toMonth,   setToMonth]   = useState(defaultMonth);

  // ── fetch once ──────────────────────────────
  useEffect(() => {
    if (!siteId || !listId) {
      console.error("DRXEntriesChart: missing siteId or listId");
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
      const out: DRXItem[] = [];

      while (next) {
        const resp = await axios.get(next, {
          headers: { Authorization: `Bearer ${token}` },
        });
        resp.data.value.forEach((it: any) => {
          out.push({
            ID:                       it.id,
            year:                     it.fields.year,
            Month:                    it.fields.Month,  // numeric string
            DRXIdeasubmittedIdea:     Number(it.fields.DRXIdeasubmittedIdea)     || 0,
            DRXIdeasubmittedIdeaGoal: Number(it.fields.DRXIdeasubmittedIdeaGoal) || 0,
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
  const { labels, submitted, goals } = useMemo(() => {
    const labs: string[] = [];
    const subs: number[] = [];
    const gls:  number[] = [];

    const recsFor = (year: string, mName: string) =>
      records.filter(r => r.year === year && monthName(r.Month) === mName);

    if (filterMode === "year") {
      MONTH_NAMES.forEach(mName => {
        labs.push(`${mName} ${selectedYear}`);
        const recs = recsFor(selectedYear, mName);
        subs.push(recs.reduce((a, r) => a + (r.DRXIdeasubmittedIdea||0), 0));
        gls.push(recs.reduce((a, r) => a + (r.DRXIdeasubmittedIdeaGoal||0), 0));
      });
    }
    else if (filterMode === "quarter") {
      const q = parseInt(selectedQuarter,10);
      const lbl = `Q${q} ${selectedYear}`;
      labs.push(lbl);
      // months in quarter: (q-1)*3 … q*3-1
      const recs = records.filter(r => {
        if (r.year !== selectedYear) return false;
        const m = parseInt(r.Month||"0",10);
        return Math.ceil(m/3) === q;
      });
      subs.push(recs.reduce((a, r) => a + (r.DRXIdeasubmittedIdea||0), 0));
      gls.push(recs.reduce((a, r) => a + (r.DRXIdeasubmittedIdeaGoal||0), 0));
    }
    else if (filterMode === "month") {
      const mName = monthName(selectedMonth);
      const lbl = `${mName} ${selectedYear}`;
      labs.push(lbl);
      const recs = recsFor(selectedYear, mName);
      subs.push(recs.reduce((a, r) => a + (r.DRXIdeasubmittedIdea||0), 0));
      gls.push(recs.reduce((a, r) => a + (r.DRXIdeasubmittedIdeaGoal||0), 0));
    }
    else /* customRange */ {
      const start = new Date(+fromYear, +fromMonth-1);
      const end   = new Date(+toYear,   +toMonth-1);
      monthRangeLabels(start, end).forEach(lbl => {
        labs.push(lbl);
        const [mName, y] = lbl.split(" ");
        const recs = recsFor(y, mName);
        subs.push(recs.reduce((a, r) => a + (r.DRXIdeasubmittedIdea||0), 0));
        gls.push(recs.reduce((a, r) => a + (r.DRXIdeasubmittedIdeaGoal||0), 0));
      });
    }

    return { labels: labs, submitted: subs, goals: gls };
  }, [
    records,
    filterMode,
    selectedYear, selectedMonth, selectedQuarter,
    fromYear, fromMonth, toYear, toMonth,
  ]);

  if (loading) {
    return <div className="p-4 text-gray-500">Loading DRX data…</div>;
  }
  if (!records.length) {
    return <div className="p-4 text-gray-500">No DRX entries available.</div>;
  }

  const filterOptions: { key: FilterMode; label: string }[] = [
    { key: "year",        label: "By Year"      },
    { key: "quarter",     label: "By Quarter"   },
    { key: "month",       label: "By Month"     },
    { key: "customRange", label: "Custom Range" },
  ];

  return (
    <div>
      {/* ── Filter Mode Toggle ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {filterOptions.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilterMode(key)}
            style={{
              padding: "6px 12px",
              background: key === filterMode ? "#007acc" : "#eee",
              color:     key === filterMode ? "#fff"    : "#000",
              border: "none", borderRadius: 4,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Sub-Filters ── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        {filterMode === "year" && (
          <label>Year:&nbsp;
            <input
              type="number"
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              style={{ width: 80 }}
            />
          </label>
        )}
        {filterMode === "quarter" && (
          <>
            <label>Year:&nbsp;
              <input
                type="number"
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                style={{ width: 80 }}
              />
            </label>
            <label>Quarter:&nbsp;
              <select
                value={selectedQuarter}
                onChange={e => setSelectedQuarter(e.target.value)}
              >
                {[1,2,3,4].map(q => (
                  <option key={q} value={q.toString()}>Q{q}</option>
                ))}
              </select>
            </label>
          </>
        )}
        {filterMode === "month" && (
          <>
            <label>Year:&nbsp;
              <input
                type="number"
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                style={{ width: 80 }}
              />
            </label>
            <label>Month:&nbsp;
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
              >
                {MONTH_NAMES.map((m,i) => (
                  <option key={m} value={(i+1).toString()}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {filterMode === "customRange" && (
          <>
            <label>From:&nbsp;
              <input
                type="number"
                value={fromYear}
                onChange={e => setFromYear(e.target.value)}
                style={{ width: 80 }}
              />
              <select
                value={fromMonth}
                onChange={e => setFromMonth(e.target.value)}
              >
                {MONTH_NAMES.map((m,i) => (
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
                onChange={e => setToYear(e.target.value)}
                style={{ width: 80 }}
              />
              <select
                value={toMonth}
                onChange={e => setToMonth(e.target.value)}
              >
                {MONTH_NAMES.map((m,i) => (
                  <option key={m} value={(i+1).toString()}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>

      {/* ── Chart ── */}
      <ReactECharts
        option={{
          title:   { text: "DRX Ideas: Submitted vs Target", left: "center" },
          tooltip: { trigger: "axis" },
          legend:  { top: 30, data: ["Target","Submitted"] },
          grid:    { bottom: 100 },
          xAxis:   {
            type: "category",
            data: labels,
            axisLabel: { rotate: 45, interval: 0, fontSize: 10 },
          },
          yAxis: { type: "value" },
          series: [
            { name: "Target",    type: "bar", data: goals     },
            { name: "Submitted", type: "bar", data: submitted },
          ],
        }}
        style={{ width: "100%", height: 450 }}
      />
    </div>
  );
};

export default DRXEntriesChart;
