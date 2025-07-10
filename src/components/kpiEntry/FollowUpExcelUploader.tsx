import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import axios from "axios";
import { getAccessToken } from "../../auth/getToken";
import { msalInstance } from "../../auth/msalInstance";
import ProjectCarousel from "../../components/ProjectCarousel";

interface IProject {
  id: string;
  displayName: string;
  mapping: { implementation: string };
}

export interface EditableRow {
  BucketID: string;            // Numéro du panier
  Area: string;                // Zone
  Carline: string;             // Carline
  Topic: string;               // your new column
  Project: string;             // SP Project
  InitiationReasons: string;   // manually selected per row
  Date: string;                // Créé le (YYYY-MM-DD)
  Statut: string;              // Statut
  Quantity: number;            // Quantité
  NettValue: number;           // Valeur nette
  TotalNettValue: number;      // Valeur nette totale
  Currency: string;            // Devise
  BucketResponsible: string;   // Nom du panier
  PostnameID: string;          // Nom du poste
  selected?: boolean;
}

interface UploadProps {
  siteId: string;
  listId: string;
  projects: IProject[];
  onComplete?: () => void;
}

const ROWS_PER_PAGE = 5;
// Pulls “Carline: A,B,C” out of a Parameters string
function extractCarlines(parameters: string): string[] {
  const m = parameters.match(/Carline:\s*([^|]+)/i);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}
const FollowUpExcelUploader: React.FC<UploadProps> = ({
  siteId,
  listId,
  projects,
  onComplete,
}) => {
  // Rows & status
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Bulk‐assign state
  const [bulkProjectId, setBulkProjectId] = useState("");
  const [bulkArea, setBulkArea] = useState("");
  const [bulkCarline, setBulkCarline] = useState("");
  const [bulkProjectCarlines, setBulkProjectCarlines] = useState<string[]>([]);

  // Pagination
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(rows.length / ROWS_PER_PAGE);
  const pageRows = rows.slice(
    (page - 1) * ROWS_PER_PAGE,
    page * ROWS_PER_PAGE
  );

  // Default the carousel to the first project
  useEffect(() => {
    if (projects.length > 0 && !bulkProjectId) {
      setBulkProjectId(projects[0].id);
    }
  }, [projects, bulkProjectId]);
  useEffect(() => {
    if (!bulkProjectId) {
      setBulkProjectCarlines([]);
      return;
    }
    const proj = projects.find((p) => p.id === bulkProjectId);
    if (!proj?.mapping.implementation) {
      setBulkProjectCarlines([]);
      return;
    }
    (async () => {
      try {
        const token = await getAccessToken(msalInstance, [
          "https://graph.microsoft.com/Sites.Read.All",
        ]);
        const resp = await axios.get(
          `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${proj.mapping.implementation}/items?$expand=fields($select=Parameters)`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const setC = new Set<string>();
        resp.data.value.forEach((item: any) => {
          extractCarlines(item.fields?.Parameters || "").forEach((c) =>
            setC.add(c)
          );
        });
        setBulkProjectCarlines(Array.from(setC).sort());
      } catch {
        setBulkProjectCarlines([]);
      }
    })();
  }, [bulkProjectId, projects, siteId]);
  // Parse the uploaded Excel (“Data” sheet)
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const sheet = wb.Sheets["Data"];
      if (!sheet) throw new Error("Missing ‘Data’ sheet");
      const raw: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const parsed = raw.map((r) => {
        // robust date parsing
        let dateVal = "";
        const c = r["Créé le"];
        if (typeof c === "number") {
          const d = XLSX.SSF.parse_date_code(c);
          dateVal = new Date(Date.UTC(d.y, d.m - 1, d.d))
            .toISOString()
            .slice(0, 10);
        } else if (c instanceof Date) {
          dateVal = c.toISOString().slice(0, 10);
        } else if (typeof c === "string") {
          const [p1, p2, p3] = c.split(/[-]/);
          if (p3 && p2 && p1.length !== 4) {
            dateVal = `${p3}-${p2.padStart(2, "0")}-${p1.padStart(
              2,
              "0"
            )}`;
          } else {
            dateVal = c;
          }
        }
        return {
          BucketID:          r["Numéro du panier"]         || "",
          Area:              r["Zone"]                     || "",
          Carline:           "",
          Topic:             r["Topic"]                    || "",
          Project:           "",
          InitiationReasons: "",
          Date:              dateVal,
          Statut:            r["Statut"]                   || "",
          Quantity:          Number(r["Quantité"]          || 0),
          NettValue:         Number(r["Valeur nette"]       || 0),
          TotalNettValue:    Number(r["Valeur nette totale"]|| 0),
          Currency:          r["Devise"]                   || "",
          BucketResponsible: r["Nom du panier"]            || "",
          PostnameID:        r["Nom du poste"]             || "",
          selected:          false,
        } as EditableRow;
      });

      setRows(parsed);
      setPage(1);
    } catch (err: any) {
      setMsg("Erreur: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Edit a single cell
  const changeRow = <K extends keyof EditableRow>(
    idx: number,
    field: K,
    value: EditableRow[K]
  ) => {
    setRows((rs) => {
      const cp = [...rs];
      cp[idx] = { ...cp[idx], [field]: value };
      return cp;
    });
  };

  // Selections
  const allSel = rows.length > 0 && rows.every((r) => r.selected);
  const someSel = rows.some((r) => r.selected);
  const toggleAll = (chk: boolean) =>
    setRows((rs) => rs.map((r) => ({ ...r, selected: chk })));
  const toggleOne = (i: number, chk: boolean) =>
    setRows((rs) =>
      rs.map((r, idx) => (idx === i ? { ...r, selected: chk } : r))
    );

  // Bulk‐apply Project/Zone/Carline
  const applyBulk = () => {
    setRows((rs) =>
      rs.map((r) =>
        r.selected
          ? { ...r, Project: bulkProjectId, Area: bulkArea, Carline: bulkCarline }
          : r
      )
    );
  };

  // Upload to SP
  const uploadAll = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const token = await getAccessToken(msalInstance, [
        "https://graph.microsoft.com/Sites.Manage.All",
      ]);
      const valid = rows.filter(
        (r) =>
          r.selected && r.Project && r.Area && r.Carline && r.InitiationReasons
      );
      if (!valid.length) {
        setMsg(
          "Veuillez sélectionner et remplir Project, Zone, Carline et Raison."
        );
        setLoading(false);
        return;
      }
      for (let r of valid) {
  // strip out 'selected'
  const { selected, ...fields } = r;
  await axios.post(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items`,
    { fields },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
}

      setMsg("Importation terminée !");
      setRows([]);
      onComplete?.();
    } catch (err: any) {
      setMsg(
        "Erreur: " + (err.response?.data?.error?.message || err.message)
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="space-y-6">
      {/* 1) File picker */}
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileUpload}
        className="file:py-2 file:px-4 file:bg-blue-50 file:text-blue-700"
      />

      {rows.length > 0 && (
        <>
          {/* 2) Bulk-assign panel (carousel outside table) */}
          <div className="p-4 bg-white/10 border rounded space-y-4">
            <p className="font-semibold text-blue-100">
              Sélectionnez des lignes puis :
            </p>

            {/* ← your ProjectCarousel */}
            <ProjectCarousel
              projects={projects}
              selectedProject={bulkProjectId}
              onProjectSelect={setBulkProjectId}
            />

            <div className="flex flex-wrap items-center gap-4">
              {/* Zone */}
              <select
                value={bulkArea}
                onChange={(e) => setBulkArea(e.target.value)}
                className="p-2 rounded text-black"
              >
                <option value="">-- Zone --</option>
                <option>MR</option>
                <option>Innenraum</option>
                <option>Autarke</option>
                <option>Cockpit</option>
              </select>

              {/* Carline (dynamic) */}
              <select
                value={bulkCarline}
                onChange={(e) => setBulkCarline(e.target.value)}
                className="p-2 rounded text-black"
              >
                <option value="">-- Carline --</option>
                {bulkProjectCarlines.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <button
                onClick={applyBulk}
                disabled={
                  !someSel ||
                  !bulkProjectId ||
                  !bulkArea ||
                  !bulkCarline
                }
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              >
                Appliquer
              </button>
            </div>
          </div>
          {/* 3) Preview table */}
          <div className="overflow-x-auto bg-white/10 border rounded p-4">
            <table className="min-w-max w-full text-white text-sm">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={allSel}
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                  </th>
                  <th>Panier ID</th>
                  <th>Zone</th>
                  <th>Carline</th>
                  <th>Topic</th>
                  <th>Projet</th>
                  <th>Raison</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => {
                  const idx = (page - 1) * ROWS_PER_PAGE + i;
                  return (
                    <tr key={idx} className="border-t border-white/20">
                      <td>
                        <input
                          type="checkbox"
                          checked={!!r.selected}
                          onChange={(e) => toggleOne(idx, e.target.checked)}
                        />
                      </td>
                      <td>
                        <input
                          value={r.BucketID}
                          onChange={(e) => changeRow(idx, "BucketID", e.target.value)}
                          className="w-28 p-1 text-black"
                        />
                      </td>
                      <td>{r.Area}</td>
                      <td>{r.Carline}</td>
                      <td>
                        <input
                          value={r.Topic}
                          onChange={(e) => changeRow(idx, "Topic", e.target.value)}
                          className="w-32 p-1 text-black"
                        />
                      </td>
                      <td>
                        {projects.find((p) => p.id === r.Project)?.displayName}
                      </td>
                      <td>
                        <select
                          value={r.InitiationReasons}
                          onChange={(e) => changeRow(idx, "InitiationReasons", e.target.value)}
                          className="p-1 text-black"
                        >
                          <option value="">– Raison –</option>
                          <option value="demande suite à un changement technique (aeb)">
                            demande suite à un changement technique (aeb)
                          </option>
                          <option value="demande suite une optimisation">
                            demande suite une optimisation
                          </option>
                          <option value="demande suite mail/revendication">
                            demande suite mail/revendication
                          </option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* pagination */}
            <div className="mt-4 flex justify-between items-center text-white">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-white/20 rounded disabled:opacity-50"
              >
                ← Prev
              </button>
              <span>
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 bg-white/20 rounded disabled:opacity-50"
              >
                Next →
              </button>
            </div>

            {/* upload */}
            <button
              onClick={uploadAll}
              disabled={loading}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              Upload All to SharePoint
            </button>
          </div>
        </>
      )}

      {loading && <p className="text-blue-300">En cours…</p>}
      {msg && <p className="text-green-300 font-semibold">{msg}</p>}
    </div>
  );
};

export default FollowUpExcelUploader;
