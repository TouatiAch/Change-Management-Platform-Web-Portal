// src/components/dashboard/followupcost/ProjectCostChart.tsx

import React, { useState, useEffect } from "react";
import ReactECharts from "echarts-for-react";
import axios from "axios";
import { getAccessToken } from "../../../auth/getToken";
import { msalInstance } from "../../../auth/msalInstance";

interface Props {
  siteId: string;
  followListId: string;
  targetListId: string;
  projectId: string;   // e.g. "mercedes-benz" or "draxlameir"
  year: number;
}

// helper to normalize "Mercedes-Benz" ↔ "mercedes-benz"
function normalizeId(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "-");
}

export const ProjectCostChart: React.FC<Props> = ({
  siteId,
  followListId,
  targetListId,
  projectId,
  year,
}) => {
  const [monthlyActual,  setMonthlyActual]  = useState<number[]>(Array(12).fill(0));
  const [monthlyTarget,  setMonthlyTarget]  = useState<number[]>(Array(12).fill(0));
  const [loading,        setLoading]        = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const token = await getAccessToken(msalInstance, ["Sites.Read.All"]);
      if (!token) return;

      const projNorm = normalizeId(projectId);
      const seenProjects = new Set<string>();

      // 1) fetch actuals
      const act = Array(12).fill(0);
      let urlA = `https://graph.microsoft.com/v1.0/sites/${siteId}` +
                 `/lists/${followListId}/items?expand=fields&$top=500`;
      while (urlA && !cancel) {
        const resp = await axios.get(urlA, {
          headers: { Authorization: `Bearer ${token}` },
        });
        for (const it of resp.data.value) {
          const f = it.fields;
          if (!f.Date || !f.Project) continue;
          seenProjects.add(f.Project);
          const pNorm = normalizeId(f.Project);
          if (projNorm !== normalizeId("draxlmaeir") && pNorm !== projNorm) {
            continue;
          }
          const d = new Date(f.Date);
          if (d.getFullYear() === year) {
            act[d.getMonth()] += Number(f.TotalNettValue) || 0;
          }
        }
        urlA = resp.data["@odata.nextLink"] || "";
      }

      // 2) fetch targets
      const tar = Array(12).fill(0);
      let urlT = `https://graph.microsoft.com/v1.0/sites/${siteId}` +
                 `/lists/${targetListId}/items?expand=fields&$top=500`;
      while (urlT && !cancel) {
        const resp = await axios.get(urlT, {
          headers: { Authorization: `Bearer ${token}` },
        });
        for (const it of resp.data.value) {
          const f = it.fields;
          if (!f.Project) continue;
          seenProjects.add(f.Project);
          const pNorm = normalizeId(f.Project);
          if (projNorm !== normalizeId("draxlmaeir") && pNorm !== projNorm) {
            continue;
          }
          if (f.Year !== year) continue;
          const m = Number(f.Month);
          if (m >= 1 && m <= 12) {
            tar[m - 1] += Number(f.Monthlytarget) || 0;
          }
        }
        urlT = resp.data["@odata.nextLink"] || "";
      }

      if (!cancel) {
        // 3) cumulative target line
        const cumT = tar.slice();
        for (let i = 1; i < 12; i++) cumT[i] += cumT[i - 1];

        console.log("🟢 [ProjectCostChart] saw these Project names in the lists:", Array.from(seenProjects));
        setMonthlyActual(act);
        setMonthlyTarget(cumT);
        setLoading(false);
      }
    })();

    return () => { cancel = true; };
  }, [siteId, followListId, targetListId, projectId, year]);

  if (loading) {
    return <p>Loading chart…</p>;
  }

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const humanProjectName = projectId
  .split('-')
  .map(w => w.charAt(0).toUpperCase() + w.slice(1))
  .join(' ');
  return (
    <ReactECharts
  option={{
   title: {
     text: `${humanProjectName} – Actual vs. Cumulative Target`,
     left: "center"
   },
    tooltip: { trigger: "axis" },
    legend: { data: ["Actual","Target"], top: 24 },
    toolbox: { feature: { saveAsImage: {} } },
    xAxis: { 
      type: "category", 
      data: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] 
    },
    // ONE shared Y-axis:
    yAxis: {
      type: "value",
      name: "€",
      axisLabel: { formatter: "{value}" }
    },
    series: [
               {
            name: "Actual",
            type: "bar",
            data: monthlyActual.map(v => +v.toFixed(0)),
            label: {
              show: true,
              position: "top",          // or "inside" if you prefer
              formatter: "{c}",
              backgroundColor: "auto",  // match the bar color
              padding: [4, 8],
              borderRadius: 4,
              color: "#fff",
              offset: [0, -6],          // lift it just above the bar
              fontSize: 12
            }
          },
      {
        name: "Target",
        type: "line",
        // uses the same axis now
        data: monthlyTarget.map(v => +v.toFixed(0)),
        smooth: true,
        lineStyle: { type: "dashed" },
      }
    ],
  }}
  style={{ height: 450, width: "100%" }}
/>

  );
};
