import type { SeriesOption } from "echarts";
import { DowntimeRecord } from "./types";

/**
 * Build a bar‐series for a single project.
 */
export function makeProjectDowntimeSeries(
  records: DowntimeRecord[],
  monthLabels: string[],
  getMonthName: (m: string) => string,
  project: string
): SeriesOption {
  return {
    name: project,
    type: "bar",
    data: monthLabels.map(label => {
      const [mName, yr] = label.split(" ");
      return records
        .filter(r =>
          r.Project === project &&
          getMonthName(r.Monthid) === mName &&
          r.year === yr
        )
        .reduce((sum, r) => sum + (r.downtime || 0), 0);
    }),
    yAxisIndex: 0,
  };
}

/**
 * Build a single bar‐series that sums downtime across *all* projects.
 */
export function makeAggregateDowntimeSeries(
  records: DowntimeRecord[],
  monthLabels: string[],
  getMonthName: (m: string) => string
): SeriesOption {
  return {
    name: "Total Downtime (min)",
    type: "bar",
    data: monthLabels.map(label => {
      const [mName, yr] = label.split(" ");
      return records
        .filter(r =>
          getMonthName(r.Monthid) === mName &&
          r.year === yr
        )
        .reduce((sum, r) => sum + (r.downtime || 0), 0);
    }),
    yAxisIndex: 0,
  };
}
