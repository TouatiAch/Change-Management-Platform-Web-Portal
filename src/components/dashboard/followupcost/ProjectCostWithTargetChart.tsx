// src/components/followupcost/ProjectCostWithTargetChart.tsx

import React from "react";
import ReactECharts from "echarts-for-react";
import { FollowCostItem } from "../../../pages/types";

/** Parse “DD.MM.YYYY HH:mm:ss” or “DD.MM.YYYY” */
function parseEuropeanDate(dateStr: string): Date {
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;

  const [datePart, timePart = "00:00:00"] = dateStr.split(" ");
  const [day, month, year]               = datePart.split(".").map(Number);
  const [h, m, s]                        = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, h, m, s);
}

interface Props {
  data: FollowCostItem[];
  /** per‐project flat monthly target, e.g. { "ProjA": 9000, "ProjB": 5000 } */
  monthlyTarget: Record<string, number>;
  /** Restrict to a specific year (optional) */
  year?: number;
}

export const ProjectCostWithTargetChart: React.FC<Props> = ({
  data,
  monthlyTarget,
  year = new Date().getFullYear(),
}) => {
  // 1) Buckets: project → monthKey (YYYY-MM) → sum of values
  const actuals: Record<string, Record<string, number>> = {};
  data.forEach(item => {
    if (!item.Date) return;
    const dt = parseEuropeanDate(item.Date);
    if (dt.getFullYear() !== year) return;

    const project = item.Project || "–";
    const monthKey = dt.toISOString().slice(0, 7);

    actuals[project] = actuals[project] || {};
    actuals[project][monthKey] = (actuals[project][monthKey] || 0) + item.TotalNettValue;
  });

  // 2) Build sorted list of months present (or all 12 months if you prefer)
  const monthSet = new Set<string>();
  Object.values(actuals).forEach(projMap =>
    Object.keys(projMap).forEach(m => monthSet.add(m))
  );
  const months = Array.from(monthSet).sort();

  // 3) For each project, build an actual‐cumulative array and a target‐cumulative array
  const series: any[] = [];
  Object.keys(actuals).forEach(project => {
    const monthValues = months.map(m => actuals[project][m] || 0);

    // cumulative actual
    const cumActual = monthValues.reduce<number[]>((acc, v, i) => {
      acc.push((acc[i - 1] || 0) + v);
      return acc;
    }, []);

    // cumulative target
    const targetPerMonth = monthlyTarget[project] || 0;
    const cumTarget = months.map((_, i) => targetPerMonth * (i + 1));

    // push bar series for actuals
    series.push({
      name: `${project} (Actual)`,
      type: "bar",
      data: cumActual,
      stack: project,            // stack per project so bars don’t overlap
      barMaxWidth: 30,
      label: {
        show: true,
        position: "top",
        formatter: (p: any) => `€${p.value.toLocaleString()}`,
        backgroundColor: "auto",
        padding: [4, 8],
        borderRadius: 4,
        color: "#fff",
        fontSize: 12,
        offset: [0, -6],
      },
    });

    // push line series for target
    series.push({
      name: `${project} (Target)`,
      type: "line",
      data: cumTarget,
      smooth: true,
      symbol: "circle",
      symbolSize: 6,
      lineStyle: { type: "dashed" },
      tooltip: { valueFormatter: (v: number) => `€${v.toLocaleString()}` },
    });
  });

  const option = {
    color: ["#5470C6", "#91CC75", "#FAC858", "#EE6666", "#73C0DE"],

    tooltip: { trigger: "axis" },

    legend: {
      type: "scroll",
      orient: "horizontal",
      top: 10,
    },

    toolbox: {
      show: true,
      feature: { saveAsImage: { title: "Save as Image" } },
    },

    xAxis: {
      type: "category",
      data: months,
      axisLabel: { rotate: 0, fontSize: 14 },
      axisTick: { alignWithLabel: true },
    },

    yAxis: {
      type: "value",
      name: "€",
      nameTextStyle: { fontSize: 16 },
      axisLabel: { fontSize: 14 },
    },

    series,
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: 450, width: "100%" }}
      notMerge={true}
      lazyUpdate={true}
    />
  );
};
