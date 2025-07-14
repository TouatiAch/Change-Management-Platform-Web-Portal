// src/pages/FollowupCostDashboard.tsx
import React, { useState } from "react";
import { FilterMode, FollowCostItem } from "../../../pages/types";
import { ProjectCostWithTargetChart } from "./ProjectCostWithTargetChart";
import { MonthlyTargetTable } from "./MonthlyTargetTable";

const ALL_PROJECTS = ["Proj A", "Proj B", "Proj C", "draxlameir"];

export const FollowupCostDashboard: React.FC<{
  data: FollowCostItem[];
}> = ({ data }) => {
  const [filterMode, setFilterMode] = useState<FilterMode>("month");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(1);
  const [selectedSemester, setSelectedSemester] = useState<1 | 2>(1);

  // monthlyTargets[project] = array of 12 numbers (Jan = idx 0 … Dec = idx 11)
  const [monthlyTargets, setMonthlyTargets] = useState<
    Record<string, number[]>
  >({});

  // Build a “flat” per-month target for the chart’s existing API:
  // We’ll just pass in the *single* target amount for whatever bucket
  // the chart is currently slicing by:
  // - for MONTH: the [selectedMonth-1] entry
  // - for QUARTER: sum of 3 months in that quarter
  // - for SEMESTER: sum of 6 months
  // - for YEAR: sum of all 12
  const perBucketTarget: Record<string, number> = {};
  ALL_PROJECTS.forEach((proj) => {
    const arr = monthlyTargets[proj] || Array(12).fill(0);
    let bucketValue: number;
    switch (filterMode) {
      case "month":
        bucketValue = arr[selectedMonth - 1];
        break;
      case "quarter": {
        const start = (selectedQuarter - 1) * 3;
        bucketValue = arr.slice(start, start + 3).reduce((a, b) => a + b, 0);
        break;
      }
      case "semester": {
        const start = (selectedSemester - 1) * 6;
        bucketValue = arr.slice(start, start + 6).reduce((a, b) => a + b, 0);
        break;
      }
      case "year":
      default:
        bucketValue = arr.reduce((a, b) => a + b, 0);
    }
    perBucketTarget[proj] = bucketValue;
  });

  return (
    <div style={{ padding: 20 }}>
      {/* 1) FILTER CONTROLS */}
      <div style={{ marginBottom: 16 }}>
        <label>
          View by:&nbsp;
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as FilterMode)}
          >
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
            <option value="semester">Semester</option>
            <option value="year">Year</option>
          </select>
        </label>

        {/* year picker */}
        <label style={{ marginLeft: 16 }}>
          Year:&nbsp;
          <input
            type="number"
            min={2000}
            max={2100}
            value={selectedYear}
            onChange={(e) => setSelectedYear(+e.target.value)}
          />
        </label>

        {filterMode === "month" && (
          <label style={{ marginLeft: 16 }}>
            Month:&nbsp;
            <input
              type="number"
              min={1}
              max={12}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(+e.target.value)}
            />
          </label>
        )}
        {filterMode === "quarter" && (
          <label style={{ marginLeft: 16 }}>
            Quarter:&nbsp;
            <select
              value={selectedQuarter}
              onChange={(e) =>
                setSelectedQuarter(+e.target.value as 1 | 2 | 3 | 4)
              }
            >
              <option value={1}>Q1</option>
              <option value={2}>Q2</option>
              <option value={3}>Q3</option>
              <option value={4}>Q4</option>
            </select>
          </label>
        )}
        {filterMode === "semester" && (
          <label style={{ marginLeft: 16 }}>
            Semester:&nbsp;
            <select
              value={selectedSemester}
              onChange={(e) =>
                setSelectedSemester(+e.target.value as 1 | 2)
              }
            >
              <option value={1}>H1 (Jan–Jun)</option>
              <option value={2}>H2 (Jul–Dec)</option>
            </select>
          </label>
        )}
      </div>

      {/* 2) MONTHLY TARGET TABLE */}
      <MonthlyTargetTable
        projects={ALL_PROJECTS}
        initialTargets={
          monthlyTargets // you could fetch these from an API on mount
        }
        onChange={(newMap) => setMonthlyTargets(newMap)}
      />

      {/* 3) CHART: actuals vs. cumulative target per selected bucket */}
      <ProjectCostWithTargetChart
        data={data}
        year={selectedYear}
        /** we’ll repurpose `monthlyTarget` prop to be our per-bucket flat target: */
        monthlyTarget={perBucketTarget}
      />
    </div>
  );
};
