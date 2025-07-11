// src/components/dashboard/downtime/aggregateSeries.ts

import type { SeriesOption } from "echarts";
import type { DowntimeRecord } from "./types";

export function makeAggregateDowntimeSeries(
  records: DowntimeRecord[],
  monthLabels: string[],
  getMonthName: (monthId: string) => string
): SeriesOption {
  // for each month label, sum downtime over all records matching that month/year
  const data = monthLabels.map(label => {
    const [monthName, year] = label.split(" ");
    return records
      .filter(r => getMonthName(r.Monthid) === monthName && r.year === year)
      .reduce((sum, r) => sum + parseFloat(String(r.downtime || 0)), 0);
  });

  return {
    name: "Total Downtime (min)",
    type: "bar",
    data,
    yAxisIndex: 0,
    itemStyle: { color: "#fdae61" },
  };
}
