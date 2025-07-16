// src/components/dashboard/followupcost/ProjectCostWithTargetChart.tsx

import React from "react";
import ReactECharts from "echarts-for-react";
import { FollowCostItem, FilterMode } from "../../../pages/types";

/** parse ISO or European “DD.MM.YYYY” */
function parseDate(s: string): Date {
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  const [date] = s.split(" ");
  const [day, mo, yr] = date.split(".").map(Number);
  return new Date(yr, mo - 1, day);
}

interface Props {
  data: FollowCostItem[];
  /** Map: project → { "YYYY-MM" | "YYYY-Qn" | "YYYY-Sn" | "YYYY": target } */
  monthlyTargets: Record<string, Record<string, number>>;
  /** year to show (defaults to current) */
  year?: number;
  /** grouping mode; "month" | "quarter" | "semester" | "year" */
  filterMode: FilterMode;
  /** list of all project IDs, including "draxlameir" for roll-up */
  projects: string[];
}

export const ProjectCostWithTargetChart: React.FC<Props> = ({
  data,
  monthlyTargets,
  year = new Date().getFullYear(),
  filterMode,
  projects,
}) => {
  // 1) Sum up actuals per project + periodKey
  const actuals: Record<string, Record<string, number>> = {};
  data.forEach(item => {
    if (!item.Date) return;
    const d = parseDate(item.Date);
    if (d.getFullYear() !== year) return;
    const proj = item.Project || "–";

    // compute period key based on filterMode
    let key: string;
    const m = d.getMonth() + 1;
    if (filterMode === "month") {
      key = `${year}-${String(m).padStart(2, "0")}`;           // "2025-06"
    } else if (filterMode === "quarter") {
      const q = Math.floor((m - 1) / 3) + 1;
      key = `${year}-Q${q}`;                                    // "2025-Q2"
    } else if (filterMode === "semester") {
      const s = Math.floor((m - 1) / 6) + 1;
      key = `${year}-S${s}`;                                    // "2025-S1"
    } else { // "year"
      key = String(year);
    }

    actuals[proj] = actuals[proj] || {};
    actuals[proj][key] = (actuals[proj][key] || 0) + item.TotalNettValue;
  });

  // 2) Collect all period keys from both actuals and targets
  const keySet = new Set<string>();
  Object.values(actuals).forEach(map => Object.keys(map).forEach(k => keySet.add(k)));
  Object.values(monthlyTargets).forEach(map => Object.keys(map).forEach(k => keySet.add(k)));

  // Only keep this year's keys, then sort appropriately
  const keys = Array.from(keySet)
    .filter(k => k.startsWith(String(year)))
    .sort((a, b) => {
      if (filterMode === "month") {
        return a.localeCompare(b);
      }
      if (filterMode === "year") {
        return 0; // single key, ordering irrelevant
      }
      // for Q/S: compare numeric suffix
      const na = Number(a.split(/[-QS]/)[1]);
      const nb = Number(b.split(/[-QS]/)[1]);
      return na - nb;
    });

  // 3) Build a series per project
  const series: any[] = [];

  projects.forEach(proj => {
    // skip if neither actuals nor targets exist
    if (!actuals[proj] && !monthlyTargets[proj]) return;

    // cumulative actual
    let cumA = 0;
    const dataA = keys.map(k => {
      cumA += actuals[proj]?.[k] || 0;
      return cumA;
    });

    // cumulative target
    let cumT = 0;
    const dataT = keys.map(k => {
      cumT += monthlyTargets[proj]?.[k] || 0;
      return cumT;
    });

    // bar for actual
    series.push({
      name: `${proj} Actual`,
      type: "bar",
      data: dataA,
      stack: proj,
      label: { show: true, position: "top", formatter: `€{c}` },
    });

    // line for target
    series.push({
      name: `${proj} Target`,
      type: "line",
      data: dataT,
      smooth: true,
      symbol: "circle",
      symbolSize: 6,
      lineStyle: { type: "dashed" },
      tooltip: { valueFormatter: (v: number) => `€${v.toLocaleString()}` },
    });
  });

  const option = {
    tooltip: { trigger: "axis" },
    legend: { type: "scroll", data: series.map(s => s.name) },
    toolbox: { feature: { saveAsImage: {} } },
    xAxis: {
      type: "category",
      data: keys,
      axisLabel: {
        formatter: (val: string) => val
      }
    },
    yAxis: { type: "value", name: "€" },
    series,
  };

  return <ReactECharts option={option} style={{ height: 450 }} />;
};
