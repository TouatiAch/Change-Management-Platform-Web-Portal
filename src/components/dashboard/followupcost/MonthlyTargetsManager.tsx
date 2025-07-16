// src/components/dashboard/followupcost/MonthlyTargetsManager.tsx

import React, { useEffect, useState } from "react";
import axios from "axios";
import { getAccessToken } from "../../../auth/getToken";
import { msalInstance } from "../../../auth/msalInstance";
import ProjectCarousel from "../../ProjectCarousel";

// Months for display
const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec"
];

interface Project {
  id: string;
  displayName: string;
}

// Each row: either loaded from SharePoint (has id) or new
interface TargetRow {
  id?: string;          // SharePoint item ID if exists
  Project: string;      // project id
  Year: number;         // e.g. 2025
  Month: number;        // 1–12
  Monthlytarget: number | "";  // blank for no value
}

interface MonthlyTargetsManagerProps {
  siteId: string;
  projects: Project[];
  monthlyTargetsListId: string;
}

const MonthlyTargetsManager: React.FC<MonthlyTargetsManagerProps> = ({
  siteId,
  projects,
  monthlyTargetsListId,
}) => {
  const [selectedProject, setSelectedProject] = useState<string>(projects[0]?.id || "");
  const [year] = useState<number>(new Date().getFullYear());
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 1️⃣ Load existing monthly targets when project changes
  useEffect(() => {
    if (!selectedProject || !monthlyTargetsListId) return;
    setLoading(true);
    (async () => {
      try {
        const token = await getAccessToken(msalInstance, ["Sites.Read.All"]);
        const filter = `fields/Project eq '${selectedProject}' and fields/Year eq ${year}`;
        const url = 
          `https://graph.microsoft.com/v1.0/sites/${siteId}` +
          `/lists/${monthlyTargetsListId}/items?` +
          `$expand=fields&$filter=${encodeURIComponent(filter)}`;
        const resp = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` }
        });

        // Build a map month→item
        const map: Record<number, any> = {};
        resp.data.value.forEach((it: any) => {
          const f = it.fields;
          map[Number(f.Month)] = { id: it.id, target: Number(f.Monthlytarget) };
        });

        // Create 12 rows, filling in existing or blank
        const newRows: TargetRow[] = MONTHS.map((_, idx) => {
          const monthNum = idx + 1;
          const found = map[monthNum];
          return {
            id: found?.id,
            Project: selectedProject,
            Year: year,
            Month: monthNum,
            Monthlytarget: found ? found.target : "",
          };
        });

        setRows(newRows);
        setMessage(null);
      } catch (err: any) {
        console.error(err);
        setMessage("Failed to load monthly targets: " + (err.response?.data?.error?.message || err.message));
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedProject, monthlyTargetsListId, siteId, year]);

  // 2️⃣ Handle inline edits
  const handleChange = (month: number, value: string) => {
    setRows(r =>
      r.map(row =>
        row.Month === month
          ? { ...row, Monthlytarget: value === "" ? "" : Number(value) }
          : row
      )
    );
  };

  // 3️⃣ Save all rows back to SharePoint
  const handleSave = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const token = await getAccessToken(msalInstance, ["Sites.Manage.All"]);
      for (const row of rows) {
        // skip empty
        if (row.Monthlytarget === "" ) continue;

        const fieldsPayload = {
          Project:       row.Project,
          Year:          row.Year,
          Month:         row.Month,
          Monthlytarget: row.Monthlytarget,
        };

        if (row.id) {
          // PATCH existing
          await axios.patch(
            `https://graph.microsoft.com/v1.0/sites/${siteId}` +
            `/lists/${monthlyTargetsListId}/items/${row.id}/fields`,
            fieldsPayload,
            { headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
              }
            }
          );
        } else {
          // POST new
          const resp = await axios.post(
            `https://graph.microsoft.com/v1.0/sites/${siteId}` +
            `/lists/${monthlyTargetsListId}/items`,
            { fields: fieldsPayload },
            { headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
              }
            }
          );
          row.id = resp.data.id; // store the new id for future patches
        }
      }
      setMessage("✅ Monthly targets saved successfully.");
    } catch (err: any) {
      console.error(err);
      setMessage("❌ Error saving targets: " + (err.response?.data?.error?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Set Monthly Targets</h2>

      {/* Project selection */}
      <ProjectCarousel
        projects={projects}
        selectedProject={selectedProject}
        onProjectSelect={setSelectedProject}
      />

      {/* Editable table */}
      <div className="mt-6">
        {loading && <p>Loading…</p>}
        {message && <p className="mt-2 text-red-700">{message}</p>}

        <table className="min-w-md mx-auto border rounded mt-4">
          <thead>
            <tr className="bg-gray-200">
              <th className="px-4 py-2 border">Month</th>
              <th className="px-4 py-2 border">Target (€)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.Month} className="bg-white">
                <td className="px-4 py-2 border">{MONTHS[row.Month - 1]}</td>
                <td className="px-4 py-2 border">
                  <input
                    type="number"
                    min={0}
                    value={row.Monthlytarget}
                    onChange={e => handleChange(row.Month, e.target.value)}
                    className="w-24 p-1 border rounded"
                    disabled={loading}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          onClick={handleSave}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={loading}
        >
          {loading ? "Saving..." : "Save All"}
        </button>
      </div>
    </div>
  );
};

export default MonthlyTargetsManager;
