// src/components/followupcost/MonthlyTargetTable.tsx
import React, { useState, useEffect } from "react";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface Props {
  /** List of all project names, *including* the special "draxlameir" string */
  projects: string[];
  /** Initial targets by project name → 12-entry array; defaults to all zeros */
  initialTargets?: Record<string, number[]>;
  /**
   * Callback whenever targets change:
   *   targets[project][0] = Jan, [1] = Feb, …, [11] = Dec
   */
  onChange?: (targets: Record<string, number[]>) => void;
}

export const MonthlyTargetTable: React.FC<Props> = ({
  projects,
  initialTargets = {},
  onChange,
}) => {
  // Separate out draxlameir from the rest
  const DRAXL = "draxlameir";
  const otherProjects = projects.filter(p => p !== DRAXL);

  // State only for the “other” projects; drax will be derived
  const [targets, setTargets] = useState<Record<string, number[]>>(() => {
    const t: Record<string, number[]> = {};
    otherProjects.forEach(p => {
      t[p] = initialTargets[p]?.slice(0, 12) ?? Array(12).fill(0);
    });
    return t;
  });

  // Compute draxlameir row as sum of others
  const draxlTargets = MONTHS.map((_, monthIdx) =>
    otherProjects.reduce((sum, p) => sum + (targets[p][monthIdx] || 0), 0)
  );

  // Whenever targets change (including draxl), notify parent
  useEffect(() => {
    if (!onChange) return;
    onChange({
      ...targets,
      [DRAXL]: draxlTargets,
    });
  }, [targets, draxlTargets.join(","), onChange]);

  const handleInputChange = (
    project: string,
    monthIdx: number,
    raw: string
  ) => {
    const val = parseInt(raw, 10) || 0;
    setTargets(prev => ({
      ...prev,
      [project]: prev[project].map((old, i) =>
        i === monthIdx ? val : old
      ),
    }));
  };

  return (
    <table style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr>
          <th style={thStyle}>Project</th>
          {MONTHS.map(m => (
            <th key={m} style={thStyle}>{m}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {otherProjects.map(project => (
          <tr key={project}>
            <td style={tdStyle}>{project}</td>
            {Array.from({ length: 12 }).map((_, mi) => (
              <td key={mi} style={tdStyle}>
                <input
                  type="number"
                  min={0}
                  value={targets[project][mi]}
                  onChange={e =>
                    handleInputChange(project, mi, e.target.value)
                  }
                  style={inputStyle}
                />
              </td>
            ))}
          </tr>
        ))}
        {/* draxlameir row */}
        <tr style={{ fontWeight: "bold", background: "#f9f9f9" }}>
          <td style={tdStyle}>{DRAXL}</td>
          {draxlTargets.map((v, mi) => (
            <td key={mi} style={tdStyle}>
              {v.toLocaleString()}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
};

// --- simple inline styles for clarity; adjust or replace with CSS as you like ---
const thStyle: React.CSSProperties = {
  border: "1px solid #ccc",
  padding: "8px",
  textAlign: "center",
  background: "#eee",
};
const tdStyle: React.CSSProperties = {
  border: "1px solid #ccc",
  padding: "6px",
  textAlign: "center",
};
const inputStyle: React.CSSProperties = {
  width: "80px",
  textAlign: "right",
};
