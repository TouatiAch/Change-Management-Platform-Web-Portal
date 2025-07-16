// src/components/followupcost/FollowupCostMonthlyChart.tsx

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { FollowCostItem } from "../../../pages/types";

/** same helper you had */
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
  /** selected project ("draxlmaeir" to show all) */
  selectedProject: string;
}

export const FollowupCostMonthlyChart: React.FC<Props> = ({
  data,
  selectedProject,
}) => {
  // 1) filter data by project (or all)
  const filtered = useMemo(() => {
    return data.filter((d) => {
      if (!d.Date) return false;
      if (selectedProject.toLowerCase() === "draxlmaeir") {
        return true;
      }
      return d.Project.toLowerCase() === selectedProject.toLowerCase();
    });
  }, [data, selectedProject]);

  // 2) Build sorted month buckets from filtered data
  const months = useMemo(() => {
    const set = new Set<string>();
    filtered.forEach((d) => {
      const dt = parseEuropeanDate(d.Date);
      set.add(dt.toISOString().slice(0, 7));
    });
    return Array.from(set).sort();
  }, [filtered]);

  // 3) Aggregate TotalNettValue by month
  const values = useMemo(() => {
    const map: Record<string, number> = {};
    months.forEach((m) => (map[m] = 0));
    filtered.forEach((d) => {
      const key = parseEuropeanDate(d.Date).toISOString().slice(0, 7);
      if (map[key] !== undefined) {
        map[key] += d.TotalNettValue;
      }
    });
    return months.map((m) => map[m]);
  }, [filtered, months]);

  // 4) ECharts option
  const option = useMemo(() => ({
    color: ["#5470C6"],
    toolbox: {
      feature: { saveAsImage: { title: "Save as Image" } },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: any[]) =>
        params
          .map((p) => `€${p.value.toLocaleString()}`)
          .join("\n"),
    },
    xAxis: {
      type: "category",
      data: months,
      axisLabel: { rotate: 45, fontSize: 12 },
      axisTick: { alignWithLabel: true },
    },
    yAxis: {
      type: "value",
      name: "€",
      nameTextStyle: { fontSize: 14 },
      axisLabel: { fontSize: 12 },
    },
    series: [
      {
        name: selectedProject,
        type: "bar",
        barWidth: 30,
        data: values,
        label: {
          show: true,
          position: "top",
          formatter: (p: any) => `€${p.value.toLocaleString()}`,
          backgroundColor: "auto",
          padding: [4, 8],
          borderRadius: 4,
          color: "#fff",
          offset: [0, -6],
          fontSize: 12,
        },
      },
    ],
  }), [months, values, selectedProject]);

  return (
    <ReactECharts
      option={option}
      style={{ height: 400, width: "100%" }}
    />
  );
};
