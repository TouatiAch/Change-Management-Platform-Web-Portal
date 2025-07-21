// src/components/FollowUpExcelUploader.tsx

import React, { useState } from "react";
import * as XLSX from "xlsx";
import axios from "axios";
import { getAccessToken } from "../../auth/getToken";
import { msalInstance } from "../../auth/msalInstance";
import { useNavigate } from "react-router-dom";

interface IProject {
  id: string;
  displayName: string;
  mapping: { implementation: string };
}

export interface EditableRow {
  BucketID: string;
  Carline: string;
  Topic: string;
  Project: string;
  InitiationReasons: string;
  Date: string;
  Statut: string;
  Quantity: number;
  NettValue: number;
  TotalNettValue: number;
  Currency: string;
  BucketResponsible: string;
  PostnameID: string;
  selected?: boolean;
}

interface UploadProps {
  siteId: string;
  listId: string;
  projects: IProject[];
  onComplete?: () => void;
}

const ROWS_PER_PAGE = 5;

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
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [projectCarlinesMap, setProjectCarlinesMap] = useState<Record<string, string[]>>({});
  const navigate = useNavigate();

  const totalPages = Math.ceil(rows.length / ROWS_PER_PAGE);
  const pageRows = rows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);
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

      const raw: any[] = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
        blankrows: false,
      });

      const parsed: EditableRow[] = raw.map((r, idx) => {
        const rawDate = r["Créé le"] ?? r["Date"] ?? r["date"] ?? "";
        let dateVal = "";

        if (typeof rawDate === "number") {
          const d = XLSX.SSF.parse_date_code(rawDate);
          dateVal = new Date(Date.UTC(d.y, d.m - 1, d.d, d.H, d.M, d.S)).toISOString().slice(0, 10);
        } else if (rawDate instanceof Date) {
          dateVal = rawDate.toISOString().slice(0, 10);
        } else if (typeof rawDate === "string") {
          const m = rawDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?$/);
          if (m) {
            const [, day, mon, yr, hr = "0", min = "0", sec = "0"] = m;
            const dt = new Date(Number(yr), Number(mon) - 1, Number(day), Number(hr), Number(min), Number(sec));
            dateVal = dt.toISOString().slice(0, 10);
          } else {
            const [p1, p2, p3] = rawDate.split(/[-]/);
            if (p3 && p2 && p1.length !== 4) {
              dateVal = `${p3}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;
            } else {
              dateVal = rawDate;
            }
          }
        }

        return {
          BucketID: r["Numéro du panier"] || "",
          Carline: "",
          Topic: r["Topic"] || "",
          Project: "",
          InitiationReasons: "",
          Date: dateVal,
          Statut: r["Statut"] || "",
          Quantity: Number(r["Quantité"] || 0),
          NettValue: Number(r["Valeur nette"] || 0),
          TotalNettValue: Number(r["Valeur nette totale"] || 0),
          Currency: r["Devise"] || "",
          BucketResponsible: r["Nom du panier"] || "",
          PostnameID: r["Nom du poste"] || "",
          selected: false,
        };
      });

      setRows(parsed);
      setPage(1);
    } catch (err: any) {
      setMsg("Erreur: " + err.message);
    } finally {
      setLoading(false);
    }
  };
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

  const toggleAll = (chk: boolean) =>
    setRows((rs) => rs.map((r) => ({ ...r, selected: chk })));

  const toggleOne = (i: number, chk: boolean) =>
    setRows((rs) =>
      rs.map((r, idx) => (idx === i ? { ...r, selected: chk } : r))
    );

  const loadCarlinesForProject = async (projectId: string) => {
    if (projectCarlinesMap[projectId]) return;

    const proj = projects.find((p) => p.id === projectId);
    if (!proj?.mapping.implementation) return;

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

      setProjectCarlinesMap((prev) => ({
        ...prev,
        [projectId]: Array.from(setC).sort(),
      }));
    } catch {
      setProjectCarlinesMap((prev) => ({ ...prev, [projectId]: [] }));
    }
  };

  const uploadOne = async (r: EditableRow) => {
    setLoading(true);
    setMsg(null);
    try {
      if (!r.Project || !r.Carline || !r.InitiationReasons) {
        setMsg("Veuillez remplir Project, Carline et Raison.");
        setLoading(false);
        return;
      }

      const token = await getAccessToken(msalInstance, [
        "https://graph.microsoft.com/Sites.Manage.All",
      ]);

      const payloadFields = {
        Project: r.Project,
        Carline: r.Carline,
        InitiationReasons: r.InitiationReasons,
        BucketID: r.BucketID,
        Date: r.Date,
        Statut: r.Statut,
        Quantity: r.Quantity,
        NettValue: r.NettValue,
        TotalNettValue: r.TotalNettValue,
        Currency: r.Currency,
        BucketResponsible: r.BucketResponsible,
        PostnameID: r.PostnameID,
        Topic: r.Topic,
      };

      await axios.post(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items`,
        { fields: payloadFields },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      setMsg("Ligne importée avec succès !");
    } catch (err: any) {
      setMsg("Erreur: " + (err.response?.data?.error?.message || err.message));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="space-y-6">
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileUpload}
        className="file:py-2 file:px-4 file:bg-blue-50 file:text-blue-700"
      />

      {rows.length > 0 && (
        <div className="overflow-x-auto bg-white/10 border rounded p-4">
          <table className="min-w-max w-full text-white text-sm">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && rows.every((r) => r.selected)}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                </th>
                <th>Panier ID</th>
                <th>Topic</th>
                <th>Projet</th>
                <th>Carline</th>
                <th>Raison</th>
                <th>Action</th>
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
                    <td>
                      <input
                        value={r.Topic}
                        onChange={(e) => changeRow(idx, "Topic", e.target.value)}
                        className="w-32 p-1 text-black"
                      />
                    </td>
                    {/* Project Select */}
                    <td>
                      <select
                        value={r.Project}
                        onChange={async (e) => {
                          const newProj = e.target.value;
                          await loadCarlinesForProject(newProj);
                          changeRow(idx, "Project", newProj);
                          changeRow(idx, "Carline", ""); // reset
                        }}
                        className="p-1 text-black"
                      >
                        <option value="">– Projet –</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.displayName}
                          </option>
                        ))}
                      </select>
                    </td>
                    {/* Carline Select */}
                    <td>
                      <select
                        value={r.Carline}
                        onChange={(e) => changeRow(idx, "Carline", e.target.value)}
                        className="p-1 text-black"
                        disabled={!r.Project}
                      >
                        <option value="">– Carline –</option>
                        {(projectCarlinesMap[r.Project] || []).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    {/* Reason Select */}
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
                        <option value="demande à la suite d'un mail/réunion d'analyse de réclamation">
                          demande à la suite d'un mail/réunion d'analyse de réclamation
                        </option>
                        <option value="suite demande PT">
                          suite demande PT
                        </option>
                      </select>
                    </td>
                    {/* Upload Button */}
                    <td>
                      <button
                        onClick={() => uploadOne(r)}
                        disabled={loading}
                        className="px-2 py-1 bg-green-600 text-white rounded text-xs"
                      >
                        Upload
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="mt-4 flex justify-between items-center text-white">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-white/20 rounded disabled:opacity-50"
            >
              ← Prev
            </button>
            <span>Page {page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 bg-white/20 rounded disabled:opacity-50"
            >
              Next →
            </button>
          </div>

          {/* Navigation shortcut */}
          <button
            onClick={() => navigate("/follow-cost-editor")}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-md text-sm transition"
          >
            Go to FollowUpCost List
          </button>
        </div>
      )}

      {loading && <p className="text-blue-300">En cours…</p>}
      {msg && <p className="text-green-300 font-semibold">{msg}</p>}
    </div>
  );
};

export default FollowUpExcelUploader;
