// src/components/dashboard/followupcost/FollowupCostDashboard.tsx

import React, { useState } from "react";
import { FilterMode, FollowCostItem } from "../../../pages/types";
import { ProjectCostWithTargetChart } from "./ProjectCostWithTargetChart";
import { MonthlyTargetTableContainer } from "./MonthlyTargetTableContainer";
import { useMonthlyTargets } from "../../../hooks/useMonthlyTargets";
import { getConfig } from "../../../services/configService";

const ALL_PROJECTS = ["Mercedes-Benz", "Lamborghini", "draxlameir"];

export const FollowupCostDashboard: React.FC<{ data: FollowCostItem[] }> = ({ data }) => {
  // 1️⃣ Chart filter state
  const [filterMode, setFilterMode] = useState<FilterMode>("month");
  const [year, setYear]             = useState<number>(new Date().getFullYear());

  // 2️⃣ Get siteId & MonthlyTargets listId from config
  const cfg = getConfig();
  const siteId      = cfg.siteId;
  const monthlyList = cfg.lists.find(l => l.name === "MonthlyTargets")?.listId || "";

  // 3️⃣ Prepare monthlyTargets map via hook
  const monthlyTargets = useMonthlyTargets(
    siteId,
    monthlyList,
    year,
    ALL_PROJECTS
  );

  return (
    <div style={{ padding: 20 }}>
      <h2>Follow-up Cost Dashboard</h2>

      {/* ── Editable Targets Table ── */}
      <section style={{ margin: "2rem 0" }}>
        <h3>Set Monthly Targets</h3>
        <MonthlyTargetTableContainer
          siteId={siteId}
          listId={monthlyList}
          year={year}
          projects={ALL_PROJECTS}
        />
      </section>

      {/* ── Chart Controls ── */}
      <section style={{ margin: "2rem 0" }}>
        <label>
          View by:&nbsp;
          <select
            value={filterMode}
            onChange={e => setFilterMode(e.target.value as FilterMode)}
          >
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
            <option value="semester">Semester</option>
          </select>
        </label>
        &nbsp;&nbsp;
        <label>
          Year:&nbsp;
          <input
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={e => setYear(+e.target.value)}
          />
        </label>
      </section>

      {/* ── Per-project cumulative bar+line chart ── */}
      <section style={{ margin: "2rem 0" }}>
        <ProjectCostWithTargetChart
          data={data}
          monthlyTargets={monthlyTargets}
          year={year}
          filterMode={filterMode}
          projects={ALL_PROJECTS}
        />
      </section>
    </div>
  );
};
