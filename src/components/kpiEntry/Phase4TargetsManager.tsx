import React, { useEffect, useState } from "react";
import axios from "axios";
import { getAccessToken } from "../../auth/getToken";
import { msalInstance } from "../../auth/msalInstance";
import ProjectCarousel from "../ProjectCarousel";


// Departments to configure targets for
const DEPARTMENTS = ["PaV", "QS", "PSCR", "Logistic"];

interface Project {
  id: string;
  displayName: string;
}

// Each target entry
interface TargetRow {
  id?: string; // SharePoint item ID if exists
  Project: string;
  Department: string;
  Target: number | "";
}

// Main component
interface Phase4TargetsManagerProps {
  siteId: string;
  projects: Project[];
  phase4TargetsListId: string; // ID of the "Phase4Targets" SharePoint list
}

const Phase4TargetsManager: React.FC<Phase4TargetsManagerProps> = ({
  siteId,
  projects,
  phase4TargetsListId,
}) => {
  const [selectedProject, setSelectedProject] = useState<string>(projects[0]?.id || "");
  const [targetRows, setTargetRows] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Load targets from SharePoint on project change
  useEffect(() => {
    if (!selectedProject || !phase4TargetsListId) return;
    setLoading(true);

    (async () => {
      try {
        const token = await getAccessToken(msalInstance, ["Sites.Read.All"]);
        const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${phase4TargetsListId}/items?$expand=fields&$filter=fields/Project eq '${selectedProject}'`;
        const resp = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
        const rows: TargetRow[] = DEPARTMENTS.map((dept) => {
          const found = resp.data.value.find(
            (item: any) =>
              item.fields.Project === selectedProject && item.fields.Department === dept
          );
          return {
            id: found?.id,
            Project: selectedProject,
            Department: dept,
            Target: found?.fields.Target ?? "",
          };
        });
        setTargetRows(rows);
        setMessage(null);
      } catch (err: any) {
        setMessage("Failed to load targets: " + (err.response?.data?.error?.message || err.message));
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedProject, phase4TargetsListId, siteId]);

  // Handle editing a target
  const handleTargetChange = (dept: string, value: string) => {
    setTargetRows((rows) =>
      rows.map((row) =>
        row.Department === dept
          ? { ...row, Target: value === "" ? "" : Number(value) }
          : row
      )
    );
  };

  // Save all rows to SharePoint (add or update)
  const handleSave = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const token = await getAccessToken(msalInstance, ["Sites.Manage.All"]);
      for (const row of targetRows) {
        // If value is empty, skip (you could also optionally delete in SharePoint)
        if (row.Target === "") continue;
        const body = {
          fields: {
            Project: row.Project,
            Department: row.Department,
            Target: row.Target,
          },
        };

        if (row.id) {
          // Update existing item
          await axios.patch(
            `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${phase4TargetsListId}/items/${row.id}/fields`,
            body.fields,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );
        } else {
          // Create new item
          await axios.post(
            `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${phase4TargetsListId}/items`,
            body,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );
        }
      }
      setMessage("✅ Targets saved successfully.");
    } catch (err: any) {
      setMessage("❌ Error saving targets: " + (err.response?.data?.error?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Set Phase 4 Targets</h2>
      {/* Project Carousel */}
      <ProjectCarousel
        projects={projects}
        selectedProject={selectedProject}
        onProjectSelect={setSelectedProject}
      />
      {/* Editable targets table */}
      <div className="mt-8">
        <table className="min-w-md mx-auto border rounded">
          <thead>
            <tr className="bg-blue-800 text-white">
              <th className="px-3 py-2 border">Department</th>
              <th className="px-3 py-2 border">Target</th>
            </tr>
          </thead>
          <tbody>
            {targetRows.map((row) => (
              <tr key={row.Department} className="bg-white/80">
                <td className="px-3 py-2 border">{row.Department}</td>
                <td className="px-3 py-2 border">
                  <input
                    type="number"
                    value={row.Target}
                    min={0}
                    onChange={(e) => handleTargetChange(row.Department, e.target.value)}
                    className="w-32 p-1 border rounded"
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
          {loading ? "Saving..." : "Save Targets"}
        </button>
        {message && <div className="mt-4 text-yellow-800">{message}</div>}
      </div>
    </div>
  );
};

export default Phase4TargetsManager;
