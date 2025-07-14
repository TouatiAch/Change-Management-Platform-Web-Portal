import React, { useState, useEffect, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import axios from "axios";

import { getConfig }       from "../../../services/configService";
import { getAccessToken }  from "../../../auth/getToken";
import { msalInstance }    from "../../../auth/msalInstance";

export interface DowntimeRecord {
  Project: string;
  year: string;
  Monthid: string; // "01"–"12"
  downtime: number;
  rateofdowntime: number;
  Targetdowntime: number;
  seuildinterventiondowntime: number;
}

interface Props {
  /** e.g. "draxlmaeir" to aggregate all projects */
  selectedProject: string;
  /** if true, labels will stay “by quarter” instead of “by month” */
  isQuarterly?: boolean;
}
// Two filter modes: pick any month-range, or any quarter-range
type FilterMode = "customRange" | "quarterRange";
const filterModes: { key: FilterMode; label: string }[] = [
  { key: "customRange",  label: "Custom Range"  },
  { key: "quarterRange", label: "Quarter Range" },
];

export const UnplannedDowntimeChart: React.FC<Props> = ({
  selectedProject,
  isQuarterly = false,
}) => {
  // raw data + loading
  const [records, setRecords] = useState<DowntimeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // filter mode state
  const [filterMode, setFilterMode] = useState<FilterMode>("customRange");

  // custom-range state
  const now = new Date();
  const defaultYear  = now.getFullYear().toString();
  const defaultMonth = String(now.getMonth() + 1).padStart(2, "0");
  const [fromYear,  setFromYear]  = useState(defaultYear);
  const [fromMonth, setFromMonth] = useState(defaultMonth);
  const [toYear,    setToYear]    = useState(defaultYear);
  const [toMonth,   setToMonth]   = useState(defaultMonth);

  // quarter-range state
  const [fromQuarter,     setFromQuarter]     = useState<1|2|3|4>(1);
  const [fromQuarterYear, setFromQuarterYear] = useState(defaultYear);
  const [toQuarter,       setToQuarter]       = useState<1|2|3|4>(1);
  const [toQuarterYear,   setToQuarterYear]   = useState(defaultYear);
  useEffect(() => {
    const cfg = getConfig();
    const siteId = cfg.siteId;

    // **Lookup** the “downtime” list in cfg.lists
    const downtimeCfg = cfg.lists.find(l => l.name === "downtime");
    if (!downtimeCfg) {
      console.error("No ListConfig for 'downtime' found in configService");
      setLoading(false);
      return;
    }
    const listId = downtimeCfg.listId;

    let cancelled = false;
    (async () => {
      setLoading(true);
      const token = await getAccessToken(msalInstance, ["Sites.Read.All"]);
      let nextLink = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?expand=fields&$top=2000`;
      const all: DowntimeRecord[] = [];

      while (nextLink) {
        const resp = await axios.get(nextLink, {
          headers: { Authorization: `Bearer ${token}` },
        });
        resp.data.value.forEach((it: any) => {
          all.push({
            Project:                    it.fields.Project || "",
            year:                       it.fields.year,
            Monthid:                    it.fields.Month.padStart(2, "0"),
            downtime:                   Number(it.fields.downtime)                    || 0,
            rateofdowntime:             Number(it.fields.rateofdowntime)              || 0,
            Targetdowntime:             Number(it.fields.Targetdowntime)              || 0,
            seuildinterventiondowntime: Number(it.fields.seuildinterventiondowntime)  || 0,
          });
        });
        nextLink = resp.data["@odata.nextLink"] || "";
      }

      if (!cancelled) setRecords(all);
      setLoading(false);
    })().catch(err => {
      console.error(err);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);
  // Month names
  const monthsOrder = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  const getMonthName = (m: string) => {
    const idx = parseInt(m, 10) - 1;
    return monthsOrder[idx] || "Unknown";
  };

  // Build all “Month YYYY” between two dates
  function getMonthRangeLabels(start: Date, end: Date): string[] {
    const labels: string[] = [];
    const cur = new Date(start.getFullYear(), start.getMonth());
    while (cur <= end) {
      labels.push(`${monthsOrder[cur.getMonth()]} ${cur.getFullYear()}`);
      cur.setMonth(cur.getMonth() + 1);
    }
    return labels;
  }

  // Build all “Qn YYYY” between two quarter-years
  function getQuarterRangeLabels(
    fY: number, fQ: number, tY: number, tQ: number
  ): string[] {
    const labels: string[] = [];
    let y = fY, q = fQ;
    while (y < tY || (y === tY && q <= tQ)) {
      labels.push(`Q${q} ${y}`);
      q++;
      if (q > 4) { q = 1; y++; }
    }
    return labels;
  }
  // 1) Sort all records chronologically
  const sorted = useMemo(
    () => [...records].sort((a, b) =>
      parseInt(a.year,10) !== parseInt(b.year,10)
        ? parseInt(a.year,10) - parseInt(b.year,10)
        : parseInt(a.Monthid,10) - parseInt(b.Monthid,10)
    ),
    [records]
  );

  // 2) Decide X-axis labels & which records to include
  let monthLabels: string[];
  let filtered = sorted;

  if (filterMode === "customRange") {
    const start = new Date(+fromYear, +fromMonth - 1);
    const end   = new Date(+toYear,   +toMonth   - 1);
    monthLabels = getMonthRangeLabels(start, end);
    filtered = sorted.filter(r => {
      const d = new Date(+r.year, +r.Monthid - 1);
      return d >= start && d <= end;
    });
  } else {
    // quarterRange
    const fY = +fromQuarterYear, tY = +toQuarterYear;
    const fQ = fromQuarter,    tQ = toQuarter;
    monthLabels = getQuarterRangeLabels(fY, fQ, tY, tQ);
    filtered = sorted.filter(r => {
      const y = +r.year;
      const q = Math.ceil(+r.Monthid / 3);
      if (y < fY || y > tY) return false;
      if (y === fY && q < fQ) return false;
      if (y === tY && q > tQ) return false;
      return true;
    });
  }

  // 3) Aggregate vs single-project mode
  const isAggregate = selectedProject.toLowerCase() === "draxlmaeir";
  // Bar‐series: either one “Total Downtime” or one project
  const barSeries = useMemo(() => ({
    name: isAggregate ? "Total Downtime (min)" : selectedProject,
    type: "bar" as const,
    data: monthLabels.map(lbl => {
      if (filterMode === "quarterRange") {
        const [qLabel, yLabel] = lbl.split(" ");
        const q = +qLabel.replace("Q", "");
        const y = +yLabel;
        return filtered
          .filter(r => {
            const yr = +r.year;
            const qr = Math.ceil(+r.Monthid / 3);
            const ok = isAggregate
              ? true
              : r.Project.toLowerCase() === selectedProject.toLowerCase();
            return yr === y && qr === q && ok;
          })
          .reduce((sum, r) => sum + r.downtime, 0);
      } else {
        const [mName, yLabel] = lbl.split(" ");
        return filtered
          .filter(r => {
            const ok = isAggregate
              ? true
              : r.Project.toLowerCase() === selectedProject.toLowerCase();
            return (
              getMonthName(r.Monthid) === mName &&
              r.year === yLabel &&
              ok
            );
          })
          .reduce((sum, r) => sum + r.downtime, 0);
      }
    }),
    yAxisIndex: 0,
  }), [filtered, monthLabels, isAggregate, selectedProject, filterMode]);

  // Helper to build the three KPI line‐series
  function makeLineSeries(
    name: string,
    field: keyof DowntimeRecord,
    factor = 1,
    style: any
  ) {
    return {
      name,
      type: "line" as const,
      smooth: true,
      data: monthLabels.map(lbl => {
        let vals: number[] = [];
        if (filterMode === "quarterRange") {
          const [qLabel, yLabel] = lbl.split(" ");
          const q = +qLabel.replace("Q", "");
          const y = +yLabel;
          vals = filtered
            .filter(r => {
              const ok = isAggregate
                ? true
                : r.Project.toLowerCase() === selectedProject.toLowerCase();
              return (
                +r.year === y &&
                Math.ceil(+r.Monthid/3) === q &&
                ok
              );
            })
            .map(r => +r[field] || 0);
        } else {
          const [mName, yLabel] = lbl.split(" ");
          vals = filtered
            .filter(r => {
              const ok = isAggregate
                ? true
                : r.Project.toLowerCase() === selectedProject.toLowerCase();
              return (
                getMonthName(r.Monthid) === mName &&
                r.year === yLabel &&
                ok
              );
            })
            .map(r => +r[field] || 0);
        }
        if (!vals.length) return null;
        const avg = vals.reduce((a,b) => a+b, 0) / vals.length;
        return avg * factor;
      }),
      yAxisIndex: 1,
      lineStyle: style,
      itemStyle: { color: style.color },
    };
  }

  const rateSeries   = makeLineSeries("Rate of Downtime", "rateofdowntime", 100, { width: 2, color: "#2b83ba" });
  const targetSeries = makeLineSeries("Target in %",     "Targetdowntime",    1,  { type: "dashed", color: "#5e72e4" });
  const seuilSeries  = makeLineSeries("Seuil d'intervention","seuildinterventiondowntime",1,{ type:"dotted", color:"#d7191c" });
  if (loading) return <div>Loading…</div>;

  const option = {
    title: {
      text: isQuarterly
        ? "Unplanned Downtime by Quarter"
        : isAggregate
          ? "Unplanned Downtime (All Projects)"
          : `Unplanned Downtime (${selectedProject})`,
      left: "center",
    },
    tooltip: {
      trigger: "axis",
      formatter: (params: any[]) => {
        let txt = `<strong>${params[0]?.axisValue}</strong><br/>`;
        params.forEach(p => {
          if (p.seriesType === "bar") {
            txt += `${p.marker}${p.seriesName}: ${p.value?.toLocaleString()} min<br/>`;
          } else {
            txt += `${p.marker}${p.seriesName}: ${p.value?.toFixed(3)}%<br/>`;
          }
        });
        return txt;
      },
    },
    legend: {
      top: 40,
      data: [
        barSeries.name,
        rateSeries.name,
        targetSeries.name,
        seuilSeries.name,
      ],
    },
    grid: { top: 80, left: 60, right: 60, bottom: 60 },
    xAxis: {
      type: "category",
      data: monthLabels,
      axisLabel: { rotate: isQuarterly ? 0 : 30 },
    },
    yAxis: [
      { type: "value", name: "Minutes",  position: "left" },
      { type: "value", name: "Percentage", position: "right",
        axisLabel: { formatter: (v: number) => `${v.toFixed(3)}%` },
      },
    ],
    series: [barSeries, rateSeries, targetSeries, seuilSeries],
  };

  return (
    <div>
      {/* Filter Mode Toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {filterModes.map(({ key, label }) => (
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

      {/* Sub-Filters */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        {filterMode === "customRange" && (
          <>
            <label>
              From&nbsp;
              <select value={fromMonth} onChange={e => setFromMonth(e.target.value)}>
                {monthsOrder.map((m,i) => (
                  <option key={m} value={String(i+1).padStart(2,"0")}>{m}</option>
                ))}
              </select>
              <input
                type="number"
                value={fromYear}
                onChange={e => setFromYear(e.target.value)}
                style={{ width: 60, marginLeft: 4 }}
              />
            </label>
            <label>
              To&nbsp;
              <select value={toMonth} onChange={e => setToMonth(e.target.value)}>
                {monthsOrder.map((m,i) => (
                  <option key={m} value={String(i+1).padStart(2,"0")}>{m}</option>
                ))}
              </select>
              <input
                type="number"
                value={toYear}
                onChange={e => setToYear(e.target.value)}
                style={{ width: 60, marginLeft: 4 }}
              />
            </label>
          </>
        )}

        {filterMode === "quarterRange" && (
          <>
            <label>
              From&nbsp;
              <select
                value={fromQuarter}
                onChange={e => setFromQuarter(+e.target.value as 1|2|3|4)}
              >
                {[1,2,3,4].map(q => <option key={q} value={q}>{`Q${q}`}</option>)}
              </select>
              <input
                type="number"
                value={fromQuarterYear}
                onChange={e => setFromQuarterYear(e.target.value)}
                style={{ width: 60, marginLeft: 4 }}
              />
            </label>
            <label>
              To&nbsp;
              <select
                value={toQuarter}
                onChange={e => setToQuarter(+e.target.value as 1|2|3|4)}
              >
                {[1,2,3,4].map(q => <option key={q} value={q}>{`Q${q}`}</option>)}
              </select>
              <input
                type="number"
                value={toQuarterYear}
                onChange={e => setToQuarterYear(e.target.value)}
                style={{ width: 60, marginLeft: 4 }}
              />
            </label>
          </>
        )}
      </div>

      {/* The Chart */}
      <ReactECharts
        option={option as any}
        style={{ width: "100%", height: 400 }}
      />
    </div>
  );
};

export default UnplannedDowntimeChart;
