// src/components/dashboard/followupcost/ProjectCostChart.tsx

import React, { useState, useEffect } from "react";
import ReactECharts from "echarts-for-react";
import axios from "axios";
import { getAccessToken } from "../../../auth/getToken";
import { msalInstance } from "../../../auth/msalInstance";

interface Props {
  siteId: string;
  followListId: string;   // SharePoint listId for the “FollowCostKPI” list
  targetListId: string;   // SharePoint listId for the “MonthlyTargets” list
  projectId: string;      // e.g. "mercedes-benz" or "draxlameir"
  year: number;
}

/** Normalize project names → graph query filter */
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
  const [monthlyActual, setMonthlyActual] = useState<number[]>(Array(12).fill(0));
  const [monthlyTarget, setMonthlyTarget] = useState<number[]>(Array(12).fill(0));
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    let canceled = false;

    (async () => {
      setLoading(true);
      const token = await getAccessToken(msalInstance, ["Sites.Read.All"]);
      if (!token) return;

      const normProj = normalizeId(projectId);
      const isAggregate = normProj === "draxlameir";

      // 1️⃣ Fetch actuals from FollowCostKPI
      const act = Array(12).fill(0);
      let urlA = `https://graph.microsoft.com/v1.0/sites/${siteId}` +
                 `/lists/${followListId}/items?expand=fields&$top=500`;
      while (urlA && !canceled) {
        const respA = await axios.get(urlA, {
          headers: { Authorization: `Bearer ${token}` },
        });
        for (const it of respA.data.value) {
          const f = it.fields;
          if (!f.Date || !f.Project) continue;
          const d = new Date(f.Date);
          if (d.getFullYear() !== year) continue;
          const pNorm = normalizeId(f.Project);
          if (!isAggregate && pNorm !== normProj) continue;
          act[d.getMonth()] += Number(f.TotalNettValue) || 0;
        }
        urlA = respA.data["@odata.nextLink"] || "";
      }

      // 2️⃣ Fetch monthly targets from MonthlyTargets
      const tgt = Array(12).fill(0);
      let urlT = `https://graph.microsoft.com/v1.0/sites/${siteId}` +
                 `/lists/${targetListId}/items?expand=fields&$top=500`;
      while (urlT && !canceled) {
        const respT = await axios.get(urlT, {
          headers: { Authorization: `Bearer ${token}` },
        });
        for (const it of respT.data.value) {
          const f = it.fields;
          if (!f.Project || f.Year !== year) continue;
          const pNorm = normalizeId(f.Project);
          if (!isAggregate && pNorm !== normProj) continue;
          const m = Number(f.Month);
          if (m >= 1 && m <= 12) {
            tgt[m - 1] += Number(f.Monthlytarget) || 0;
          }
        }
        urlT = respT.data["@odata.nextLink"] || "";
      }

      if (!canceled) {
        // 3️⃣ Turn `tgt` into a cumulative series
        const cum = tgt.slice();
        for (let i = 1; i < 12; i++) {
          cum[i] += cum[i - 1];
        }

        setMonthlyActual(act);
        setMonthlyTarget(cum);
        setLoading(false);
      }
    })();

    return () => { canceled = true; };
  }, [siteId, followListId, targetListId, projectId, year]);

  if (loading) return <p>Loading chart…</p>;

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const title  = projectId
    .split("-")
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <ReactECharts
      option={{
        title: {
          text: `${title} – Actual vs. Cumulative Target`,
          left: "center",
        },
        tooltip: { trigger: "axis" },
        legend: { data: ["Actual", "Target"], top: 24 },
        toolbox: { feature: { saveAsImage: {} } },
        xAxis: {
          type: "category",
          data: MONTHS,
          axisTick: { alignWithLabel: true },
        },
        yAxis: {
          type: "value",
          name: "€",
          axisLabel: { formatter: "{value}" },
        },
        series: [
          {
            name: "Actual",
            type: "bar",
            data: monthlyActual.map(v => +v.toFixed(0)),
            label: {
              show: true,
              position: "top",
              formatter: "{c}",
              backgroundColor: "auto",
              padding: [4, 8],
              borderRadius: 4,
              color: "#fff",
              offset: [0, -6],
              fontSize: 12,
            },
          },
          {
            name: "Target",
            type: "line",
            data: monthlyTarget.map(v => +v.toFixed(0)),
            smooth: true,
            lineStyle: { type: "dashed" },
            symbol: "circle",
            symbolSize: 6,
            tooltip: {
              valueFormatter: (v: number) => `€${v.toLocaleString()}`,
            },
          },
        ],
      }}
      style={{ height: 450, width: "100%" }}
      notMerge
      lazyUpdate
    />
  );
};
