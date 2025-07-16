// src/components/dashboard/followupcost/FollowupCostByReasonMonthlyChart.tsx

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { FollowCostItem } from "../../../pages/types";

/**
 * Parse ISO or European "DD.MM.YYYY[ HH:mm:ss]" dates into a JS Date.
 */
function parseEuropeanDate(dateStr: string): Date {
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  const [datePart, timePart = "00:00:00"] = dateStr.split(" ");
  const [day, month, year]                = datePart.split(".").map(Number);
  const [h, m, s]                         = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, h, m, s);
}

interface Props {
  data: FollowCostItem[];
  filterMode: string;          // "year", "quarter", "month", "customRange"
  selectedProject: string;     // e.g. "mercedes-benz" or "draxlmaeir"
  selectedYear: string;        // e.g. "2025"
  selectedMonth: string;       // "1"–"12"
  selectedQuarter: string;     // "1"–"4"
  fromYear?: string;
  fromMonth?: string;
  fromDay?: string;
  toYear?: string;
  toMonth?: string;
  toDay?: string;
}

export const FollowupCostByReasonMonthlyChart: React.FC<Props> = ({
  data,
  filterMode,
  selectedProject,
  selectedYear,
  selectedMonth,
  selectedQuarter,
  fromYear,
  fromMonth,
  fromDay,
  toYear,
  toMonth,
  toDay,
}) => {
  // 1) Filter raw items by project + time window
  const raw = useMemo(() => {
    return data.filter(item => {
      if (!item.Date) return false;
      const dt = parseEuropeanDate(item.Date);
      const y  = dt.getFullYear();
      const m  = dt.getMonth() + 1;

      // Project filter: either exact match or "draxlmaeir" = all
      if (
        selectedProject.toLowerCase() !== "draxlmaeir" &&
        item.Project.toLowerCase() !== selectedProject.toLowerCase()
      ) return false;

      switch (filterMode) {
        case "year":
          return y === +selectedYear;
        case "quarter": {
          if (y !== +selectedYear) return false;
          const q = +selectedQuarter;
          const minM = (q - 1) * 3 + 1;
          const maxM = q * 3;
          return m >= minM && m <= maxM;
        }
        case "month":
          return y === +selectedYear && m === +selectedMonth;
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
  }, [
    data,
    filterMode,
    selectedProject,
    selectedYear,
    selectedMonth,
    selectedQuarter,
    fromYear, fromMonth, fromDay,
    toYear,   toMonth,   toDay
  ]);

  // 2) Build sorted list of month keys "YYYY-MM"
  const months = useMemo(() => {
    const set = new Set<string>();
    raw.forEach(i => {
      const key = parseEuropeanDate(i.Date).toISOString().slice(0, 7);
      set.add(key);
    });
    return Array.from(set).sort();
  }, [raw]);

  // 3) Unique list of reasons
  const reasons = useMemo(() => {
    return Array.from(new Set(
      raw.map(i => i.InitiationReasons || "Unknown")
    )).sort();
  }, [raw]);

  // 4) Build one bar series per reason
  const series = useMemo(() => {
    const palette = ["#5470C6", "#91CC75", "#FAC858", "#EE6666", "#73C0DE"];
    return reasons.map((reason, idx) => {
      const color = palette[idx % palette.length];
      // sum TotalNettValue per month
      const dataByMonth = months.map(monthKey => {
        const sum = raw
          .filter(i => {
            const mKey = parseEuropeanDate(i.Date)
                           .toISOString().slice(0, 7);
            return mKey === monthKey
               && (i.InitiationReasons || "Unknown") === reason;
          })
          .reduce((acc, i) => acc + (Number(i.TotalNettValue) || 0), 0);
        return Math.round(sum);
      });

      return {
  name:      reason,
  type:      "bar",
  barWidth:  20,
  data:      dataByMonth,
  itemStyle: { color },
  label: {
    show:           true,
    position:       "top",
    distance:       6,
    formatter:      (p: any) => `€${p.value.toLocaleString()}`,
    fontSize:       12,
    color:          "#fff",
    backgroundColor: color,         // or use the callback above
    padding:        [2, 6],
    borderRadius:   4,
    fontWeight:     "bold"
  },
  labelLayout: {
    hideOverlap: false
  }
};

    });
  }, [raw, months, reasons]);

  // 5) ECharts option with extra padding for title & labels
  const option = useMemo(() => ({
    color:    ["#5470C6", "#91CC75", "#FAC858", "#EE6666", "#73C0DE"],
    title: {
      text:      "Total Nett Value by Reason per Month",
      left:      "center",
      top:       32,
      textStyle: { fontSize: 16 }
    },
    toolbox:  { feature: { saveAsImage: { title: "Save as Image" } } },
    tooltip:  { trigger: "axis", axisPointer: { type: "shadow" } },
    legend:   {
      data:      reasons,
      bottom:   10,
      textStyle: { fontSize: 14 }
    },
    grid: {
      left:         "3%",
      right:        "4%",
      top:          "18%",
      bottom:       "25%",
      containLabel: true
    },
    xAxis: {
      type:      "category",
      data:      months,
      axisLabel: { rotate: 30, fontSize: 12 }
    },
    yAxis: {
      type:          "value",
      name:          "€",
      nameLocation: "middle",
      nameGap:       30,
      nameTextStyle:{ fontSize: 14 },
      axisLabel:     { fontSize: 12 }
    },
    series
  }), [months, reasons, series]);

  return (
    <ReactECharts
      option={option}
      style={{ height: 400, width: "100%" }}
    />
  );
};
