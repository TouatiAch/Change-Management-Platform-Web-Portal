// src/components/dashboard/followupcost/FollowupCostByProjectReasonChart.tsx

import React from "react";
import ReactECharts from "echarts-for-react";
import { FilterMode, FollowCostItem } from "../../../pages/types";

/** Parses "DD.MM.YYYY HH:mm:ss" or "DD.MM.YYYY" */
function parseEuropeanDate(dateStr: string): Date {
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

export const FollowupCostByProjectReasonChart: React.FC<Props> = ({
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
  // 1) Filter by date (no project filter here)
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
        const q    = +selectedQuarter;
        const minM = (q - 1) * 3 + 1;
        const maxM = q * 3;
        return m >= minM && m <= maxM;
      }
      case "month":
        return y === +selectedYear && m === +selectedMonth;
      case "day":
        return y === +selectedYear && m === +selectedMonth && d === +selectedDay;
      case "weekOfMonth": {
        if (y !== +selectedYear || m !== +selectedMonth) return false;
        return Math.ceil(d / 7) === selectedWeekOfMonth;
      }
      case "weekOfYear": {
        if (y !== +selectedYear) return false;
        const start = new Date(y, 0, 1);
        const wk =
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

  // 2) Build lists of all projects & reasons
  const projects = Array.from(new Set(filtered.map(i => i.Project))).sort();
  const reasons  = Array.from(
    new Set(filtered.map(i => i.InitiationReasons || "Unknown"))
  ).sort();

  // 3) Summation matrix[project][reason]
  const matrix: Record<string, Record<string, number>> = {};
  projects.forEach(p => {
    matrix[p] = {};
    reasons.forEach(r => (matrix[p][r] = 0));
  });
  filtered.forEach(item => {
    const p = item.Project;
    const r = item.InitiationReasons || "Unknown";
    matrix[p][r] += item.TotalNettValue;
  });

  // 4) pick a color palette
  const palette = ["#5470C6", "#91CC75", "#FAC858", "#EE6666", "#73C0DE"];

  // 5) Build one series per project, with a colored “balloon” label
  const series = projects.map((p, idx) => {
    const color = palette[idx % palette.length];
    return {
      name:  p,
      type:  "bar",
      barWidth: 30,
      data:  reasons.map(r => matrix[p][r]),
      itemStyle: { color },
      label: {
        show:            true,
        position:        "top",
        formatter:       "€{c}",
        backgroundColor: color,
        padding:         [4, 8],
        borderRadius:    4,
        color:           "#fff",
        offset:          [0, -6]
      }
    };
  });

  // 6) The ECharts “option”:
  const option = {
    color:    palette,
    toolbox:  { show: true, feature: { saveAsImage: { title: "Save as Image" } } },
    legend:   {
      orient:    "horizontal",
      left:      "center",
      bottom:    10,
      itemGap:   16,
      textStyle: { fontSize: 14 },
      data:      projects
    },
    grid:     {
      left:         "3%",
      right:        "4%",
      top:          "15%",
      bottom:       "20%",
      containLabel: true
    },
    xAxis:    {
      type: "category",
      data: reasons,
      axisTick:  { alignWithLabel: true },
      axisLabel: {
        rotate:   0,
        fontSize: 12,
        interval: 0,
        formatter: (val: string) => {
          const max = 20;
          if (val.length <= max) return val;
          const idx = val.lastIndexOf(" ", max);
          if (idx > 0) return val.slice(0, idx) + "\n" + val.slice(idx + 1);
          return val.slice(0, max) + "\n" + val.slice(max);
        }
      }
    },
    yAxis:    {
      type:          "value",
      name:          "€",
      nameTextStyle: { fontSize: 16, padding: [0, 0, 8, 0] },
      axisLabel:     { fontSize: 14 }
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
