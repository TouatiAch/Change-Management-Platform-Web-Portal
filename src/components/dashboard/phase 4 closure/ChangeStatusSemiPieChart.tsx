// src/components/dashboard/ChangeStatusSemiPieChart.tsx
import React from "react";
import ReactECharts from "echarts-for-react";

export interface ChangeItem {
  Status?: string;
  // (other fields are ignored here)
}

interface Props {
  items: ChangeItem[];
}

export const ChangeStatusSemiPieChart: React.FC<Props> = ({ items }) => {
  // 1) Tally up each status
  const statusCounts: Record<string, number> = {};
  items.forEach((it) => {
    const st = it.Status?.toString() || "Unknown";
    statusCounts[st] = (statusCounts[st] || 0) + 1;
  });

  // 2) Turn into [{ name, value }]
  const data = Object.entries(statusCounts).map(([name, value]) => ({
    name,
    value,
  }));

  // 3) ECharts option for a half-donut with outside labels
  const option = {
    title: {
      text: "Change Status Distribution",
      left: "center",
      top: 1,
      textStyle: {
        fontSize: 18,
      },
    },
    tooltip: {
      trigger: "item",
      formatter: "{b}<br/>Count: {c}<br/>({d}%)",
    },
    toolbox: {
   show: true,
   feature: {
     // this is the “download as image” icon
     saveAsImage: {
       show: true,
       title: "Download as Image",
       icon: 'path://M512 0C229.2 0 0 229.2 0 512s229.2 512 512 512 512-229.2 512-512S794.8 0 512 0zM512 960C264.6 960 64 759.4 64 512S264.6 64 512 64s448 200.6 448 448-200.6 448-448 448zM640 400H544V160H480v240H384l192 192L640 400z'
     }
   }
 },
    legend: {
      top: "8%",
      left: "center",
    },
    series: [
      {
        name: "Status",
        type: "pie",
        radius: ["40%", "70%"],
        center: ["50%", "65%"],    // pushed down to make room for outside labels
        startAngle: 180,
        endAngle: 0,               // equivalent to 360
        avoidLabelOverlap: true,

        // Move percentage labels outside
        label: {
          show: true,
          position: "outside",
          formatter: "{b}: {d}%",
          fontSize: 12,
          color: "#333",
        },

        // Small connector lines from slice to label
        labelLine: {
          show: true,
          length: 15,
          length2: 10,
          lineStyle: {
            width: 1,
          },
        },

        data,
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: 300, width: "100%" }}
    />
  );
};
