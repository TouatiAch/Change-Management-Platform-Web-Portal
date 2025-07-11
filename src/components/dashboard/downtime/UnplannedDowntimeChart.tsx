import React from "react";
import ReactECharts from "echarts-for-react";
import type { DowntimeRecord } from "./types";

interface Props {
  data: DowntimeRecord[];
  isQuarterly?: boolean;
  selectedProject: string;
}

export const UnplannedDowntimeChart: React.FC<Props> = ({
  data,
  isQuarterly = false,
  selectedProject,
}) => {
  // ─── Helpers ────────────────────────────────────────────────────────────────
  const monthsOrder = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const getMonthName = (m: string) => {
    const idx = parseInt(m, 10) - 1;
    return monthsOrder[idx] || "Unknown";
  };

  // ─── 1) Sort all data by year→month ──────────────────────────────────────────
  const allSorted = [...data].sort((a, b) => {
    const yd = parseInt(a.year, 10) - parseInt(b.year, 10);
    return yd !== 0
      ? yd
      : parseInt(a.Monthid, 10) - parseInt(b.Monthid, 10);
  });

  // ─── 2) Build shared x-axis labels ─────────────────────────────────────────
  const monthLabels = Array.from(
    new Set(
      allSorted.map(r => `${getMonthName(r.Monthid)} ${r.year}`)
    )
  );

  // ─── 3) Detect “aggregate” vs “single project” ─────────────────────────────
  const isAggregate = selectedProject.toLowerCase() === "draxlmaeir";

  // ─── 4) List of projects to plot bars for ──────────────────────────────────
  const projectsToPlot = isAggregate
    ? Array.from(
        new Set(allSorted.map(r => r.Project).filter(p => !!p))
      ) as string[]
    : [selectedProject];

  // ─── 5) Build one bar-series per project, WITHOUT itemStyle.color ───────────
  const downtimeSeries = projectsToPlot.map(proj => ({
    name: isAggregate ? proj : "Downtime (min)",
    type: "bar" as const,
    data: monthLabels.map(label => {
      const [mName, yr] = label.split(" ");
      // sum downtime for this project + month
      return allSorted
        .filter(r =>
          (isAggregate
            ? r.Project === proj
            : r.Project?.toLowerCase() === proj.toLowerCase()
          ) &&
          getMonthName(r.Monthid) === mName &&
          r.year === yr
        )
        .reduce((sum, r) => sum + (Number(r.downtime) || 0), 0);
    }),
    yAxisIndex: 0,
  }));

  // ─── 6) Rate, Target & Seuil lines (fixed colors) ───────────────────────────
  const rateSeries = {
    name: "Rate of Downtime",
    type: "line" as const,
    smooth: true,
    data: monthLabels.map(label => {
      const [mName, yr] = label.split(" ");
      const rec = allSorted.find(
        r =>
          getMonthName(r.Monthid) === mName &&
          r.year === yr &&
          (isAggregate
            ? true
            : r.Project?.toLowerCase() === selectedProject.toLowerCase())
      );
      return rec && rec.rateofdowntime != null
        ? Number(rec.rateofdowntime) * 100
        : null;
    }),
    yAxisIndex: 1,
    lineStyle: { width: 2, color: "#2b83ba" },
    itemStyle: { color: "#2b83ba" },
  };

  const targetSeries = {
    name: "Target in %",
    type: "line" as const,
    smooth: true,
    data: monthLabels.map(label => {
      const [mName, yr] = label.split(" ");
      const rec = allSorted.find(
        r =>
          getMonthName(r.Monthid) === mName &&
          r.year === yr &&
          (isAggregate
            ? true
            : r.Project?.toLowerCase() === selectedProject.toLowerCase())
      );
      return rec && rec.Targetdowntime != null
        ? Number(rec.Targetdowntime)
        : null;
    }),
    yAxisIndex: 1,
    lineStyle: { type: "dashed", color: "#5e72e4" },
    itemStyle: { color: "#5e72e4" },
  };

  const seuilSeries = {
    name: "Seuil d'intervention",
    type: "line" as const,
    smooth: true,
    data: monthLabels.map(label => {
      const [mName, yr] = label.split(" ");
      const rec = allSorted.find(
        r =>
          getMonthName(r.Monthid) === mName &&
          r.year === yr &&
          (isAggregate
            ? true
            : r.Project?.toLowerCase() === selectedProject.toLowerCase())
      );
      return rec && rec.seuildinterventiondowntime != null
        ? Number(rec.seuildinterventiondowntime)
        : null;
    }),
    yAxisIndex: 1,
    lineStyle: { type: "dotted", color: "#d7191c" },
    itemStyle: { color: "#d7191c" },
  };

  // ─── 7) Compose the ECharts option ───────────────────────────────────────────
  const option = {
    // (a) Let ECharts automatically assign a different color to each series:
    //     remove all itemStyle.color on bars, and ECharts uses its default palette.
    //     If you want a custom palette, you can uncomment & define this:
    // color: ["#5470C6","#91CC75","#FAC858","#EE6666","#73C0DE","#3BA272"],

    title: {
      text: isQuarterly
        ? "Unplanned Downtime by Quarter"
        : "Unplanned Downtime by Month",
      left: "center",
    },
    tooltip: {
      trigger: "axis",
      formatter: (params: any[]) => {
        let txt = `<strong>${params[0]?.axisValue}</strong><br/>`;
        params.forEach(p => {
          if (p.seriesType === "bar") {
            txt += `${p.marker}${p.seriesName}: ${p.value?.toLocaleString()}<br/>`;
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
        ...downtimeSeries.map(s => s.name),
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
      { type: "value", name: "Minutes", position: "left" },
      {
        type: "value",
        name: "Percentage",
        position: "right",
        axisLabel: {
          formatter: (v: number) => v.toFixed(3) + "%",
        },
      },
    ],
    series: [
      ...downtimeSeries,
      rateSeries,
      targetSeries,
      seuilSeries
    ],
  };

  return (
    <ReactECharts
      option={option as any}
      style={{ width: "100%", height: 400 }}
    />
  );
};

export default UnplannedDowntimeChart;
