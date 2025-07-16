// src/components/dashboard/followupcost/FollowupCostByProjectReasonChart.tsx

import React from "react";
import ReactECharts from "echarts-for-react";
import { FilterMode, FollowCostItem } from "../../../pages/types";

/** Parse "DD.MM.YYYY HH:mm:ss" or "DD.MM.YYYY" */
function parseEuropeanDate(dateStr: string): Date {
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d;
  }
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
  // 1) Filter by date (exactly your existing logic)
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

  // 2) Unique projects & reasons
  const projects = Array.from(new Set(filtered.map(i => i.Project))).sort();
  const reasons  = Array.from(
    new Set(filtered.map(i => i.InitiationReasons || "Unknown"))
  ).sort();

  // 3) Summation matrix — **always numbers**, never strings**
  const matrix: Record<string, Record<string, number>> = {};
  projects.forEach(p => {
    matrix[p] = {};
    reasons.forEach(r => {
      matrix[p][r] = 0;
    });
  });

  filtered.forEach(item => {
    const p = item.Project;
    const r = item.InitiationReasons || "Unknown";
    // **Cast to Number** and guard NAN
    const amt = Number(item.TotalNettValue) || 0;
    matrix[p][r] += amt;
  });

  // 4) Palette
  const palette = ["#5470C6", "#91CC75", "#FAC858", "#EE6666", "#73C0DE"];

  // 5) Series — **round each bar’s value** to 0 decimals
  const series = projects.map((p, idx) => {
    const color = palette[idx % palette.length];
    return {
      name:     p,
      type:     "bar",
      barWidth: 30,
      data:     reasons.map(r => +matrix[p][r].toFixed(0)),
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

  const TITLE_MAP: Record<FilterMode, string> = {
    year:        "Total Nett Value per Project",
    quarter:     "Total Nett Value per Project",
    month:       "Total Nett Value per Project",
    day:         "Total Nett Value per Project",
    weekOfMonth: "Total Nett Value per Project",
    weekOfYear:  "Total Nett Value per Project",
    customRange: "Total Nett Value per Project",
    semester:    "Total Nett Value per Project",
  };

  // 6) Build the subtitle exactly your way
  const mainTitle = TITLE_MAP[filterMode];
  let subTitle = "";
  switch (filterMode) {
    case "year":
      subTitle = `Year ${selectedYear}`;
      break;
    case "quarter":
      subTitle = `Q${selectedQuarter} ${selectedYear}`;
      break;
    case "month":
      subTitle = `${selectedMonth}/${selectedYear}`;
      break;
    case "day":
      subTitle = `${selectedDay}/${selectedMonth}/${selectedYear}`;
      break;
    case "weekOfMonth":
      subTitle = `W${selectedWeekOfMonth} of ${selectedMonth}/${selectedYear}`;
      break;
    case "customRange":
      subTitle = `From ${fromDay}/${fromMonth}/${fromYear} to ${toDay}/${toMonth}/${toDay}`;
      break;
    // you can add semester here if you like
  }
  const fullTitle = subTitle ? `${mainTitle} — ${subTitle}` : mainTitle;

  // 7) Your exact ECharts options, unchanged:
  const option = {
    color:    palette,
    title: [
      {
        text:      fullTitle,
        left:      "center",
        top:       16,
        textStyle: { fontSize: 18 }
      }
    ],
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
      top:          "22%",
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
    yAxis: {
      type:          "value",
      name:          "€",
      nameTextStyle: { fontSize: 16, padding: [0, 0, 8, 0] },
      axisLabel:     { fontSize: 14 }
    },
     series: series.map(s => ({
     ...s,
     label: {
       ...s.label,
       distance: 8                // ↑ lift labels a bit further
     }
   }))
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: 400, width: "100%" }}
    />
  );
};
