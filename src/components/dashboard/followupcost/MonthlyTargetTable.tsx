// src/components/dashboard/followupcost/MonthlyTargetTable.tsx

import React from "react";

const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec"
];

interface Props {
  /** List of all project IDs, including "draxlameir" as the roll-up row */
  projects: string[];
  /** String values shown in each input cell for each project/month */
  rawInputs: Record<string, string[]>;
  /** Parsed numeric values for each project/month */
  numericTargets: Record<string, number[]>;
  /** Called on <input>.onChange */
  onRawChange: (project: string, monthIdx: number, value: string) => void;
  /** Called on <input>.onBlur */
  onCellBlur: (project: string, monthIdx: number) => void;
}

export const MonthlyTargetTable: React.FC<Props> = ({
  projects,
  rawInputs,
  numericTargets,
  onRawChange,
  onCellBlur,
}) => {
  const DRAXL = "draxlameir";

  // All projects except the special aggregate
  const others = projects.filter(p => p !== DRAXL);

  // Compute the aggregate row by summing numericTargets across all other projects
  const draxlSum = MONTHS.map((_, mi) =>
    others.reduce((acc, proj) => acc + (numericTargets[proj]?.[mi] || 0), 0)
  );

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={th}>Project</th>
          {MONTHS.map(m => (
            <th key={m} style={th}>{m}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {others.map(proj => (
          <tr key={proj}>
            <td style={td}>{proj}</td>
            {MONTHS.map((_, mi) => (
              <td key={mi} style={td}>
                <input
                  type="text"
                  style={input}
                  value={rawInputs[proj]?.[mi] ?? ""}
                  onChange={e => onRawChange(proj, mi, e.target.value)}
                  onBlur={() => onCellBlur(proj, mi)}
                />
              </td>
            ))}
          </tr>
        ))}

        <tr style={{ fontWeight: "bold", background: "#fafafa" }}>
          <td style={td}>{DRAXL}</td>
          {draxlSum.map((sum, mi) => (
            <td key={mi} style={td}>{sum.toLocaleString()}</td>
          ))}
        </tr>
      </tbody>
    </table>
  );
};

const th: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: 8,
  background: "#f0f0f0",
  textAlign: "center",
};

const td: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: 6,
  textAlign: "center",
};

const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  textAlign: "right",
};
