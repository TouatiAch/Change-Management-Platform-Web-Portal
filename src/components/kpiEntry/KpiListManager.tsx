import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import type { ListConfig, IProject } from "../../services/configService";
import ProjectCarousel from "../ProjectCarousel";

type NewRow = Record<string, string | number>;
type ItemRow = { id: string } & Record<string, any>;

interface Props {
  siteId: string;
  listConfig: ListConfig;
  projects: IProject[];
  getToken: () => Promise<string>;
}

export default function KpiListManager({
  siteId,
  listConfig,
  projects,
  getToken,
}: Props) {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterYear, setFilterYear] = useState("All");
  const [filterMonth, setFilterMonth] = useState("All");
  const [filterQuarter, setFilterQuarter] = useState("All");

  const pageSize = 10;
  const [page, setPage] = useState(1);

  const emptyRow: NewRow = {};
  listConfig.fields.forEach((f) => {
    emptyRow[f.name] = "";
  });
  delete emptyRow.rateofdowntime;

  const [newRow, setNewRow] = useState<NewRow>({ ...emptyRow });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const isFormValid = useMemo(() => {
    if (listConfig.hasProject && !newRow.Project) return false;
    for (const f of listConfig.fields) {
      if (f.name === "rateofdowntime") continue;
      const v = newRow[f.name];
      if (f.type === "Number" && v !== "" && isNaN(Number(String(v).replace(",", ".")))) {
        return false;
      }
    }
    return true;
  }, [newRow, listConfig]);
  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const resp = await axios.get(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listConfig.listId}/items?$expand=fields&$top=500`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setItems(
        resp.data.value.map((i: any) => {
          const fld = i.fields as Record<string, any>;
          const downtime = Number(fld.downtime) || 0;
          const prodMin = Number(fld.productionminutes) || 0;
          const rate = prodMin > 0 ? downtime / prodMin : 0;
          return {
            id: String(i.id),
            ...fld,
            rateofdowntime: rate.toFixed(4),
          };
        })
      );
    } catch (e: any) {
      setError(e.message || "Fetch failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [listConfig.listId]);

  const yearsList = useMemo(() => Array.from({ length: 151 }, (_, i) => (2000 + i).toString()), []);
  const monthsList = useMemo(() => Array.from({ length: 12 }, (_, i) => (i + 1).toString()), []);
  const quartersList = useMemo(() => ["1", "2", "3", "4"], []);
  const yearsFilter = useMemo(() => ["All", ...yearsList], [yearsList]);
  const monthsFilter = useMemo(() => ["All", ...monthsList], [monthsList]);
  const quartersFilter = useMemo(() => ["All", ...quartersList], [quartersList]);

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        const yearMatch = filterYear === "All" || String(i.year) === filterYear;
        const monthMatch = filterMonth === "All" || String(i.Month) === filterMonth;
        const quarterMatch = filterQuarter === "All" || String(i.Quarter) === filterQuarter;
        return yearMatch && monthMatch && quarterMatch;
      }),
    [items, filterYear, filterMonth, filterQuarter]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  const validateNewRow = () => {
    const errs: Record<string, string> = {};
    if (listConfig.hasProject && !newRow.Project) {
      errs.Project = "Please select a project.";
    }
    listConfig.fields.forEach((f) => {
      if (f.name === "rateofdowntime") return;
      const v = newRow[f.name];
      if (f.type === "Number" && v !== "" && isNaN(Number(String(v).replace(",", ".")))) {
        errs[f.name] = `${f.label ?? f.name} must be a number`;
      }
    });
    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const createItem = async () => {
    if (!validateNewRow()) return;
    setError(null);
    try {
      const token = await getToken();
      const fieldsPayload = Object.fromEntries(
        Object.entries(newRow).map(([k, v]) => {
          const cfgFld = listConfig.fields.find(f => f.name === k);
          if (cfgFld?.type === "Number" && typeof v === "string") {
            return [k, Number(v.replace(",", "."))];
          }
          return [k, v];
        })
      );
      await axios.post(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listConfig.listId}/items`,
        { fields: fieldsPayload },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewRow({ ...emptyRow });
      setPage(1);
      fetchItems();
    } catch (e: any) {
      setError(e.message || "Create failed");
    }
  };

  const updateItem = async (id: string, field: string, raw: string | number) => {
    setError(null);
    try {
      const token = await getToken();
      let value: string | number = raw;
      const cfgFld = listConfig.fields.find(f => f.name === field);
      if (cfgFld?.type === "Number" && typeof raw === "string") {
        value = Number(raw.replace(",", "."));
      }
      await axios.patch(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listConfig.listId}/items/${id}/fields`,
        { [field]: value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchItems();
    } catch (e: any) {
      setError(e.message || "Update failed");
    }
  };

  const deleteItem = async (id: string) => {
    setError(null);
    try {
      const token = await getToken();
      await axios.delete(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listConfig.listId}/items/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchItems();
    } catch (e: any) {
      setError(e.message || "Delete failed");
    }
  };
  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl shadow-lg p-8 space-y-6">
      <h2 className="text-3xl font-bold text-white">{listConfig.name}</h2>
      {error && <p className="text-red-400">{error}</p>}

      <div className="bg-white/5 p-6 rounded-xl space-y-4">
        <h3 className="text-xl text-white/80 font-semibold mb-2">Add New Entry</h3>

        {listConfig.hasProject && (
          <ProjectCarousel
            projects={projects}
            selectedProject={String(newRow.Project || "")}
            onProjectSelect={(projId) =>
              setNewRow((r) => ({ ...r, Project: projId }))
            }
          />
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {listConfig.fields.map((f) => {
            if (f.name === "rateofdowntime") return null;

            const opts =
              f.name.toLowerCase() === "year"
                ? yearsList
                : f.name.toLowerCase() === "month"
                ? monthsList
                : f.name.toLowerCase() === "quarter"
                ? quartersList
                : null;

            const labelContent = (
              <label className="text-white text-base font-bold mb-1">
                {f.label}{" "}
              </label>
            );

            return (
              <div key={f.name} className="flex flex-col">
                {labelContent}
                {opts ? (
                  <select
                    className="px-4 py-2 rounded-full bg-white/80 text-black text-sm font-medium shadow focus:outline-none"
                    value={String(newRow[f.name] || "")}
                    onChange={(e) =>
                      setNewRow((r) => ({ ...r, [f.name]: e.target.value }))
                    }
                  >
                    <option value="">Select {f.name}</option>
                    {opts.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type === "Number" ? "number" : "text"}
                    inputMode={f.type === "Number" ? "decimal" : undefined}
                    value={String(newRow[f.name] || "")}
                    onChange={(e) =>
                      setNewRow((r) => ({ ...r, [f.name]: e.target.value }))
                    }
                    className="px-4 py-2 text-center text-lg font-bold rounded-full bg-white/80 text-black shadow focus:outline-none"
                    placeholder={f.label}
                  />
                )}
                {validationErrors[f.name] && (
                  <p className="text-red-300 text-sm mt-1">
                    {validationErrors[f.name]}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={createItem}
          disabled={!isFormValid}
          className="mt-4 px-6 py-3 bg-white/20 hover:bg-white/30 rounded-2xl shadow-md text-white font-semibold transition"
        >
          Save
        </button>
      </div>
      <div className="flex flex-wrap gap-4">
        {[["Year", filterYear, setFilterYear, yearsFilter],
          ["Month", filterMonth, setFilterMonth, monthsFilter],
          ["Quarter", filterQuarter, setFilterQuarter, quartersFilter]
        ].map(([label, value, setter, options], idx) => (
          <select
            key={idx}
            className="px-4 py-2 rounded-full bg-white/80 text-black font-medium shadow"
            value={value as string}
            onChange={(e) => {
              (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value);
              setPage(1);
            }}
          >
            {(options as string[]).map((o) => (
              <option key={o} value={o}>
                {o === "All" ? `All ${label}` : o}
              </option>
            ))}
          </select>
        ))}
      </div>

      {loading ? (
        <p className="text-white">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-white">
            <thead>
              <tr className="border-b border-white/20 bg-white/5">
                {listConfig.fields.map((f) => (
                  <th key={f.name} className="px-3 py-2 text-left">{f.label}</th>
                ))}
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((row, idx) => (
                <tr
                  key={row.id}
                  className={`border-t border-white/10 ${idx % 2 === 0 ? "bg-white/5" : ""} hover:bg-white/10`}
                >
                  {listConfig.fields.map((f) => (
                    <td key={f.name} className="px-3 py-2">
                      {f.name === "rateofdowntime" ? (
                        <span>{row.rateofdowntime}</span>
                      ) : (
                        <input
                          type={f.type === "Number" ? "number" : "text"}
                          inputMode={f.type === "Number" ? "decimal" : undefined}
                          defaultValue={String(row[f.name] ?? "")}
                          onBlur={(e) =>
                            updateItem(row.id, f.name, e.target.value)
                          }
                          className="w-full px-3 py-1 rounded-full bg-white/80 text-black font-semibold shadow focus:outline-none"
                        />
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <button
                      onClick={() => deleteItem(row.id)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-2xl shadow-sm text-white"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-between items-center text-white">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="px-4 py-1 bg-white/10 hover:bg-white/20 rounded shadow-md disabled:opacity-40"
        >
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="px-4 py-1 bg-white/10 hover:bg-white/20 rounded shadow-md disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
