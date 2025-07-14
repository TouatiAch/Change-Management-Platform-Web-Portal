// src/components/dashboard/followupcost/FollowupCostProjectTimeSeriesChart.tsx

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

export const FollowupCostProjectTimeSeriesChart: React.FC<Props> = ({
  data,
  filterMode,
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
  // 1) Filter by date (all projects included)
  const filtered = data.filter(item => {
    if (!item.Date) return false;
    const dt = parseEuropeanDate(item.Date);
    const y  = dt.getFullYear();
    const m  = dt.getMonth() + 1;
    const d  = dt.getDate();

    switch (filterMode) {
      case "year":
        return y === +selectedYear;
      case "quarter": {
        if (y !== +selectedYear) return false;
        const q = +selectedQuarter;
        return m >= (q - 1) * 3 + 1 && m <= q * 3;
      }
      case "month":
        return y === +selectedYear && m === +selectedMonth;
      case "day":
        return y === +selectedYear && m === +selectedMonth && d === +selectedDay;
      case "weekOfMonth":
        if (y !== +selectedYear || m !== +selectedMonth) return false;
        return Math.ceil(d / 7) === selectedWeekOfMonth;
      case "weekOfYear": {
        if (y !== +selectedYear) return false;
        const start = new Date(y, 0, 1);
        const wk    =
          Math.floor((dt.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)) +
          1;
        return wk === selectedWeekOfYear;
      }
      case "customRange": {
        if (!(fromYear && fromMonth && fromDay && toYear && toMonth && toDay))
          return true;
        const from = new Date(+fromYear, +fromMonth - 1, +fromDay);
        const to   = new Date(+toYear,   +toMonth   - 1, +toDay);
        return dt >= from && dt <= to;
      }
      default:
        return true;
    }
  });

  // 2) Build x‐axis categories (dates) and get unique project names
  const xKeys = Array.from(
    new Set(
      filtered.map(i => {
        const dt = parseEuropeanDate(i.Date);
        switch (filterMode) {
          case "year":
            return String(dt.getFullYear());
          case "quarter": {
            const q = Math.floor(dt.getMonth() / 3) + 1;
            return `Q${q} ${dt.getFullYear()}`;
          }
          case "month":
            return dt.toISOString().slice(0, 7);
          case "day":
            return dt.toISOString().slice(0, 10);
          case "weekOfMonth":
            return `W${Math.ceil(dt.getDate() / 7)} ${dt.toLocaleString("default", {
              month: "short",
            })} ${dt.getFullYear()}`;
          case "weekOfYear": {
            const start = new Date(dt.getFullYear(), 0, 1);
            const wk    =
              Math.floor((dt.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)) +
              1;
            return `W${wk} ${dt.getFullYear()}`;
          }
          default:
            return dt.toISOString().slice(0, 10);
        }
      })
    )
  ).sort();

  const projects = Array.from(new Set(filtered.map(i => i.Project))).sort();

  // 3) Build one series per project
  const series = projects.map(proj => ({
    name:       proj,
    type:       "line",           // switch to "bar" + barWidth if you prefer bars
    data:       xKeys.map(x =>
      filtered
        .filter(i => {
          const dt = parseEuropeanDate(i.Date);
          let key: string;
          switch (filterMode) {
            case "year":
              key = String(dt.getFullYear());
              break;
            case "quarter": {
              const q = Math.floor(dt.getMonth() / 3) + 1;
              key   = `Q${q} ${dt.getFullYear()}`;
            }
            break;
            case "month":
              key = dt.toISOString().slice(0, 7);
              break;
            case "day":
              key = dt.toISOString().slice(0, 10);
              break;
            case "weekOfMonth":
              key = `W${Math.ceil(dt.getDate() / 7)} ${dt.toLocaleString("default", {
                month: "short",
              })} ${dt.getFullYear()}`;
              break;
            case "weekOfYear": {
              const start = new Date(dt.getFullYear(), 0, 1);
              const wk    =
                Math.floor((dt.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)) +
                1;
              key = `W${wk} ${dt.getFullYear()}`;
            }
            break;
            default:
              key = dt.toISOString().slice(0, 10);
          }
          return key === x && i.Project === proj;
        })
        .reduce((sum, i) => sum + i.TotalNettValue, 0)
    ),
    // optional: make the line a bit thicker or larger symbols
    // lineStyle: { width: 3 },
    // symbolSize: 6,
  }));

  const option = {
    title: {
      text: "Total Nett Value over Time (per Project)",
      left: "center",
      textStyle: { fontSize: 16 },
    },

    toolbox: {
      show: true,
      feature: {
        saveAsImage: { title: "Save as Image" }
      }
    },

    tooltip: { trigger: "axis" },

    legend: {
      top: 30,
      data: projects,
      textStyle: { fontSize: 14 }
    },

    xAxis: {
      type: "category",
      data: xKeys,
      axisLabel: {
        rotate: 0,      // keep labels horizontal
        fontSize: 14,   // larger font
      }
    },

    yAxis: {
      type: "value",
      name: "€",
      nameTextStyle: { fontSize: 16 },
      axisLabel: { fontSize: 14 }
    },

    series
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: 400, width: "100%" }}
    />
  );
};
