// src/components/dashboard/followupcost/FollowupCostByReasonTimeSeriesChart.tsx

import React from "react";
import ReactECharts from "echarts-for-react";
import { FilterMode, FollowCostItem } from "../../../pages/types";

/** Parse "DD.MM.YYYY HH:mm:ss" or "DD.MM.YYYY" */
function parseEuropeanDate(dateStr: string): Date {
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d;
  }

  // 2) Fallback to European style "DD.MM.YYYY[ HH:mm:ss]"
  const [datePart, timePart = "00:00:00"] = dateStr.split(" ");
  const [day, month, year]               = datePart.split(".").map(Number);
  const [h, m, s]                        = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, h, m, s);
}
interface Props {
  data: FollowCostItem[];
  filterMode: FilterMode;
  selectedProject: string;
  selectedYear: string;
  selectedMonth: string;
  selectedDay: string;
  selectedQuarter: string;
  selectedWeekOfMonth?: number;
  selectedWeekOfYear?: number;
  fromYear?: string;
  fromMonth?: string;
  fromDay?: string;
  toYear?: string;
  toMonth?: string;
  toDay?: string;
}

export const FollowupCostByReasonTimeSeriesChart: React.FC<Props> = ({
  data,
  filterMode,
  selectedProject,
  selectedYear,
  selectedMonth,
  selectedDay,
  selectedQuarter,
  selectedWeekOfMonth,
  selectedWeekOfYear,
  fromYear,
  fromMonth,
  fromDay,
  toYear,
  toMonth,
  toDay,
}) => {
  // 1) filter by project & date
  const raw = data.filter(item => {
    if (!item.Date) return false;
    const dt = parseEuropeanDate(item.Date);
    const y  = dt.getFullYear();
    const m  = dt.getMonth() + 1;
    const d  = dt.getDate();

    // keep all projects if "draxlmaeir"
    if (
      selectedProject.toLowerCase() !== "draxlmaeir" &&
      item.Project.toLowerCase() !== selectedProject.toLowerCase()
    ) {
      return false;
    }

    switch (filterMode) {
      case "year": return y === +selectedYear;
      case "quarter": {
        if (y !== +selectedYear) return false;
        const q = +selectedQuarter;
        return m >= (q - 1) * 3 + 1 && m <= q * 3;
      }
      case "month": return y === +selectedYear && m === +selectedMonth;
      case "day":   return y === +selectedYear && m === +selectedMonth && d === +selectedDay;
      case "weekOfMonth":
        if (y !== +selectedYear || m !== +selectedMonth) return false;
        return Math.ceil(d / 7) === selectedWeekOfMonth;
      case "weekOfYear": {
        if (y !== +selectedYear) return false;
        const start = new Date(y, 0, 1);
        const wk = Math.floor((dt.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1;
        return wk === selectedWeekOfYear;
      }
      case "customRange": {
        if (!(fromYear && fromMonth && fromDay && toYear && toMonth && toDay)) return true;
        const from = new Date(+fromYear, +fromMonth - 1, +fromDay);
        const to   = new Date(+toYear,   +toMonth   - 1, +toDay);
        return dt >= from && dt <= to;
      }
      default:
        return true;
    }
  });

  // 2) build your date‐buckets and reason‐list
  const dates = Array.from(
    new Set(
      raw.map(i => {
        const dt = parseEuropeanDate(i.Date);
        switch (filterMode) {
          case "day":   return dt.toISOString().slice(0, 10);
          case "month": return dt.toISOString().slice(0, 7);
          case "year":  return String(dt.getFullYear());
          case "quarter": {
            const q = Math.floor(dt.getMonth() / 3) + 1;
            return `Q${q} ${dt.getFullYear()}`;
          }
          case "weekOfMonth":
            return `W${Math.ceil(dt.getDate() / 7)} ${dt
              .toLocaleString("default", { month: "short" })} ${dt.getFullYear()}`;
          case "weekOfYear": {
            const start = new Date(dt.getFullYear(), 0, 1);
            const wk = Math.floor((dt.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1;
            return `W${wk} ${dt.getFullYear()}`;
          }
          default:
            return dt.toISOString().slice(0, 10);
        }
      })
    )
  ).sort();

  const reasons = Array.from(new Set(raw.map(i => i.InitiationReasons || "Unknown"))).sort();

  // 3) one side-by-side bar series per reason
  const series = reasons.map(reason => ({
    name: reason,
    type: "bar",
    barWidth: 20,
    // no `stack` property → they will appear next to each other
    data: dates.map(d =>
      raw
        .filter(i => {
          // same grouping‐key logic:
          const dt = parseEuropeanDate(i.Date);
          let key: string;
          switch (filterMode) {
            case "day":   key = dt.toISOString().slice(0, 10); break;
            case "month": key = dt.toISOString().slice(0, 7); break;
            case "year":  key = String(dt.getFullYear()); break;
            case "quarter": {
              const q = Math.floor(dt.getMonth() / 3) + 1;
              key = `Q${q} ${dt.getFullYear()}`; break;
            }
            case "weekOfMonth":
              key = `W${Math.ceil(dt.getDate() / 7)} ${dt
                .toLocaleString("default", { month: "short" })} ${dt.getFullYear()}`; break;
            case "weekOfYear": {
              const start = new Date(dt.getFullYear(), 0, 1);
              const wk = Math.floor((dt.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1;
              key = `W${wk} ${dt.getFullYear()}`; break;
            }
            default:
              key = dt.toISOString().slice(0, 10);
          }
          return key === d && (i.InitiationReasons || "Unknown") === reason;
        })
        .reduce((sum, i) => sum + i.TotalNettValue, 0)
    ),
  }));
// just above this, make sure you have:
const PALETTE = ["#5470C6", "#91CC75", "#FAC858", "#EE6666", "#73C0DE"];

// … then replace your `option` definition with:

const option = {
  color: PALETTE,

  title: {
    text: "Total Nett Value by Reason over Time",
    left: "center",
    textStyle: { fontSize: 16 },
  },

  toolbox: {
    show: true,
    feature: {
      saveAsImage: { title: "Save as Image" }
    }
  },

  tooltip: {
    trigger: "axis",
    axisPointer: { type: "shadow" },
    formatter: (params: any[]) =>
      params
        .map(p =>
          `${p.marker} ${p.seriesName}: €${(p.value as number).toLocaleString()}`
        )
        .join("<br/>")
  },

  legend: {
    orient: "horizontal",
    bottom: 10,
    itemGap: 16,
    textStyle: { fontSize: 14 },
    data: reasons
  },

  grid: {
    left: "3%",
    right: "4%",
    bottom: "20%",
    containLabel: true
  },

  xAxis: {
    type: "category",
    data: dates,
    axisLabel: {
      rotate: 30,        // tilt labels 30°
      interval: "auto",  // show every Nth if still too crowded
      fontSize: 12,
      formatter: (val: string) => { 
        // optional: wrap long labels onto two lines
        const max = 15;
        if (val.length <= max) return val;
        const idx = val.lastIndexOf(" ", max);
        if (idx > 0) return val.slice(0, idx) + "\n" + val.slice(idx + 1);
        return val.slice(0, max) + "\n" + val.slice(max);
      }
    },
    axisTick: { alignWithLabel: true }
  },

  yAxis: {
    type: "value",
    name: "€",
    nameTextStyle: { fontSize: 16 },
    axisLabel: { fontSize: 14 }
  },

  series: series.map((s, idx) => ({
    ...s,
    barWidth: 20,
    label: {
      show: true,
      position: "top",
      formatter: (p: any) => `€${(p.value as number).toLocaleString()}`,
      backgroundColor: "auto",
      padding: [4, 8],
      borderRadius: 4,
      color: "#fff",
      fontSize: 12,
      offset: [0, -6]
    },
    // ← auto-hide overlapping balloons
    labelLayout: {
      hideOverlap: true
    }
  }))
};

  return <ReactECharts option={option} style={{ height: 400, width: "100%" }} />;
};
