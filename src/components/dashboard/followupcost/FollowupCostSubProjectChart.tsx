// src/components/dashboard/followupcost/FollowupCostSubProjectChart.tsx

import React from "react";
import ReactECharts from "echarts-for-react";
import { FilterMode, FollowCostItem } from "../../../pages/types";

/** Parse "DD.MM.YYYY HH:mm:ss" or "DD.MM.YYYY" */
function parseEuropeanDate(dateStr: string): Date {
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;

  const [datePart, timePart = "00:00:00"] = dateStr.split(" ");
  const [day, month, year]               = datePart.split(".").map(Number);
  const [h, m, s]                        = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, h, m, s);
}

// 5-color palette, will cycle if >5 sub-projects
const PALETTE = ["#5470C6", "#91CC75", "#FAC858", "#EE6666", "#73C0DE"];

// Friendly titles per filterMode
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

export const FollowupCostSubProjectChart: React.FC<Props> = ({
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
  // 1) Filter by date slice
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
      case "weekOfMonth": {
        if (y !== +selectedYear || m !== +selectedMonth) return false;
        return Math.ceil(d / 7) === selectedWeekOfMonth;
      }
      case "weekOfYear": {
        if (y !== +selectedYear) return false;
        const start = new Date(y, 0, 1);
        const wk    = Math.floor((dt.getTime() - start.getTime())/(1000*60*60*24*7)) + 1;
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

  // 2) Aggregate per sub-project
  const byProject: Record<string, number> = {};
  filtered.forEach(item => {
    const p = item.Project || "Unknown";
    byProject[p] = (byProject[p] || 0) + item.TotalNettValue;
  });
  const projects = Object.keys(byProject).sort();
  const values   = projects.map(p => byProject[p]);

  // 3) Compute a subtitle suffix based on filterMode + selections
  const mainTitle = TITLE_MAP[filterMode];

// build a little “sub” string from your selected filters:
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
  // etc…
  case "customRange":
    subTitle = `From ${fromDay}/${fromMonth}/${fromYear} to ${toDay}/${toMonth}/${toYear}`;
    break;
}

// now glue them together on one line:
const fullTitle = subTitle
  ? `${mainTitle} — ${subTitle}`
  : mainTitle;

  // 4) ECharts option
  const option = {
    color: PALETTE,
    title: [
      {
         text: fullTitle,
        left: "center",
        top: 16,
        textStyle: { fontSize: 18 }
      }
    ],
    toolbox: {
      show: true,
      feature: { saveAsImage: { title: "Save as Image" } }
    },
    tooltip: {
      trigger: "axis",
      formatter: (params: any[]) =>
        params
          .map(p => `${p.axisValueLabel}: €${(p.value as number).toLocaleString()}`)
          .join("<br/>")
    },
    xAxis: {
      type: "category",
      data: projects,
      axisLabel: { rotate: 0, fontSize: 12 },
      axisTick:  { alignWithLabel: true }
    },
    yAxis: {
      type: "value",
      name: "€",
      nameTextStyle: { fontSize: 14 },
      axisLabel:     { fontSize: 12 }
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "15%",
      containLabel: true
    },
    series: [
      {
        name: "Sub-Project",
        type: "bar",
        barWidth: 20,
        data: values,
        label: {
          show:      true,
          position:  "top",
          formatter: (p: any) => `€${(p.value as number).toLocaleString()}`,
           backgroundColor: "auto",
          padding:         [4, 8],
          borderRadius:    4,
          color:           "#fff",
          offset:          [0, -6],
          fontSize: 12
        }
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: 400, width: "100%" }} />;
};
