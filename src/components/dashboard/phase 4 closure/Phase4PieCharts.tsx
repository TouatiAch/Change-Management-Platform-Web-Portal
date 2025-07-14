// src/components/Phase4PieCharts.tsx
import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import {
  parse,
  parseISO,
  isValid,
  format
} from "date-fns";

// Departments definition
const DEPARTMENTS = [
  { key: "PAV",      label: "PaV",      endField: "EnddatePAVPhase4"   },
  { key: "LOGISTIC", label: "Logistic", endField: "EndDateLogisticPhase4" },
  { key: "QS",       label: "QS",       endField: "EndDateQSPhase4"      },
  { key: "PSCR",     label: "PSCR",     endField: "EndDatePSCRPhase4"    },
];

//–– Date utilities (same as your table) ––
function parseDateSafe(str?: string): Date | undefined {
  if (!str) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str))       return parseISO(str);
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) return parse(str, "dd/MM/yyyy", new Date());
  const d = new Date(str);
  return isValid(d) ? d : undefined;
}
function calculateBusinessDays(startStr?: string, endStr?: string): number | "" {
  const s = parseDateSafe(startStr), e = parseDateSafe(endStr);
  if (!s || !e || s > e) return "";
  let cnt = 0, cur = new Date(s);
  while (cur <= e) {
    const d = cur.getDay();
    if (d >= 1 && d <= 5) cnt++;
    cur.setDate(cur.getDate() + 1);
  }
  return cnt;
}

//–– Types from your table ––
export interface Project {
  id: string;
  displayName: string;
  mapping: { implementation: string };
}
export interface ChangeItem {
  ID: string;
  StartdatePhase4?: string;
  // department end dates:
  EnddatePAVPhase4?:   string;
  EndDateLogisticPhase4?: string;
  EndDateQSPhase4?:    string;
  EndDatePSCRPhase4?:  string;
  processyear?:  string;
  processmonth?: string;
}
export interface TargetItem {
  Project: string;
  Department: string;
  Target: number;
}

interface Props {
  /** All loaded change-items (already filtered by project/year/month) */
  changeItems: ChangeItem[];
  /** All loaded target rows from SP */
  targets: TargetItem[];
  /** Currently selected project, or undefined to include all */
  selectedProjectId?: string;
  /** Project definitions so we can match displayName ↔ id */
  projects: Project[];
}

const Phase4PieCharts: React.FC<Props> = ({
  changeItems,
  targets,
  projects,
  selectedProjectId,
}) => {
  // Prepare per-department counts
  const charts = useMemo(() => {
    return DEPARTMENTS.map(({ key, label, endField }) => {
      let under = 0, over = 0, open = 0;

      changeItems.forEach((item) => {
        const endDate = (item as any)[endField] as string | undefined;
        const days = calculateBusinessDays(item.StartdatePhase4, endDate);

        // find target for this project/department
        let target = 0;
        if (selectedProjectId) {
          const proj = projects.find((p) => p.id === selectedProjectId);
          const t = targets.find(
            (t) =>
              (t.Project === proj?.displayName || t.Project === proj?.id) &&
              t.Department === key
          );
          target = t?.Target ?? 0;
        }

        if (!endDate) {
          open++;
        } else if (typeof days === "number") {
          if (days > target) over++;
          else under++;
        } else {
          open++;
        }
      });

      return {
        dept: label,
        seriesData: [
          { name: "Under/On Target", value: under },
          { name: "Over Target",     value: over },
          { name: "Open",            value: open },
        ] as { name: string; value: number }[],
      };
    });
  }, [changeItems, targets, projects, selectedProjectId]);

  // Common ECharts option generator
  const makeOption = (dept: string, data: { name: string; value: number }[]) => ({
    title: {
      text: dept,
      left: "center",
      top: 8,
      textStyle: { fontSize: 14 }
    },
    tooltip: {
      trigger: "item",
      formatter: "{b}: {c} ({d}%)"
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
      bottom: 0,
      data: data.map((d) => d.name)
    },
    series: [
      {
        type: "pie",
        radius: ["40%", "60%"],
        center: ["50%", "50%"],
        label: {
          formatter: "{d}%\n{b}",
          fontSize: 12
        },
        data
      }
    ]
  });

  return (
   <div className="grid grid-cols-1 gap-4 mb-8">
      {charts.map(({ dept, seriesData }) => (
        <div key={dept} className="bg-white p-4 rounded shadow w-full">
          <ReactECharts
            option={makeOption(dept, seriesData)}
            style={{ width: "100%", height: 300 }}
          />
        </div>
      ))}
    </div>
  );
};

export default Phase4PieCharts;
