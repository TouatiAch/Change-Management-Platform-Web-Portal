// src/components/followupcost/FollowupCostTimeSeriesChart.tsx

import React from "react";
import ReactECharts from "echarts-for-react";
import { FilterMode, FollowCostItem } from "../../../pages/types";

/** Parse "DD.MM.YYYY HH:mm:ss" or "DD.MM.YYYY" */
function parseEuropeanDate(dateStr: string): Date {
  const [datePart, timePart = "00:00:00"] = dateStr.split(" ");
  const [day, month, year] = datePart.split(".").map(n => parseInt(n, 10));
  const [h, m, s]          = timePart.split(":").map(n => parseInt(n, 10));
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

export const FollowupCostTimeSeriesChart: React.FC<Props> = ({
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
  // 1) Filter by project (or all if "draxlmaeir") + date bucket
  const filtered = data.filter(item => {
    if (!item.Date) return false;
    const dt = parseEuropeanDate(item.Date);
    const y  = dt.getFullYear();
    const m  = dt.getMonth() + 1;
    const d  = dt.getDate();

    // project filter: only exclude non-matching when not "draxlmaeir"
    if (
      selectedProject.toLowerCase() !== "draxlmaeir" &&
      item.Project.toLowerCase() !== selectedProject.toLowerCase()
    ) {
      return false;
    }

    // date filter
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

  // 2) Group all filtered items by your selected time slice
  const buckets: Record<string, number> = {};
  filtered.forEach(item => {
    const dt = parseEuropeanDate(item.Date);
    let key: string;

    switch (filterMode) {
      case "year":
        key = String(dt.getFullYear());
        break;
      case "quarter": {
        const q = Math.floor(dt.getMonth() / 3) + 1;
        key = `Q${q} ${dt.getFullYear()}`;
        break;
      }
      case "month":
        key = dt.toISOString().slice(0, 7);
        break;
      case "day":
        key = dt.toISOString().slice(0, 10);
        break;
      case "weekOfMonth":
        key = `W${Math.ceil(dt.getDate() / 7)} ${dt
          .toLocaleString("default", { month: "short" })
          } ${dt.getFullYear()}`;
        break;
      case "weekOfYear": {
        const start = new Date(dt.getFullYear(), 0, 1);
        const wk =
          Math.floor((dt.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)) +
          1;
        key = `W${wk} ${dt.getFullYear()}`;
        break;
      }
      default:
        key = dt.toISOString().slice(0, 10);
    }

    buckets[key] = (buckets[key] || 0) + item.TotalNettValue;
  });

  const categories = Object.keys(buckets).sort();
  const values     = categories.map(k => buckets[k]);
const PALETTE = ["#5470C6", "#91CC75", "#FAC858", "#EE6666", "#73C0DE"];
  // 3) Build the ECharts option
  const option = {
  // 1) pick up the palette so each bar auto-colors
  color: PALETTE,

  toolbox: {
    show: true,
    feature: {
      saveAsImage: { title: "Save as Image" },
    },
  },

  tooltip: {
    trigger: "axis",
    formatter: (params: any[]) => `€${params[0].value.toLocaleString()}`,
  },

  xAxis: {
    type: "category",
    data: categories,
    axisLabel: { rotate: 0, fontSize: 14 },
    axisTick: { alignWithLabel: true },
  },

  yAxis: {
    type: "value",
    name: "€",
    nameTextStyle: { fontSize: 16 },
    axisLabel: { fontSize: 14 },
  },

  series: [
    {
      type: "bar",
      barWidth: 30,
      data: values,
      // 2) add a label with background/padding/borderRadius → your “balloon”
      label: {
        show: true,
        position: "top",
        formatter: (p: any) => `€${p.value.toLocaleString()}`,
        // background picks the bar’s color automatically:
        backgroundColor: "auto",
        padding: [4, 8],
        borderRadius: 4,
        color: "#fff",
        fontSize: 12,
        // lift it up so it doesn’t overlap the bar
        offset: [0, -6],
      },
    },
  ],
};

  return <ReactECharts option={option} style={{ height: 400, width: "100%" }} />;
};
