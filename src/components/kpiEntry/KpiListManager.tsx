// src/components/kpiEntry/KpiListManager.tsx
import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import type { ListConfig, IProject } from "../../services/configService";
import ProjectCarousel from "../ProjectCarousel";

// newRow has no id; ItemRow always has id:string
type NewRow = Record<string, string | number>;
type ItemRow = { id: string } & Record<string, any>;

interface Props {
  siteId: string;
  listConfig: ListConfig;
  projects: IProject[];
  /** must return a Graph token with appropriate scope */
  getToken: () => Promise<string>;
}

export default function KpiListManager({
  siteId,
  listConfig,
  projects,
  getToken,
}: Props) {
  // ── State ─────────────────────────────────────────────────────────
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Table filters
  const [filterYear, setFilterYear] = useState("All");
  const [filterMonth, setFilterMonth] = useState("All");
  const [filterQuarter, setFilterQuarter] = useState("All");

  // Pagination
  const pageSize = 10;
  const [page, setPage] = useState(1);

  // ── Build empty newRow, but remove rateofdowntime (we calculate it)
  const emptyRow: NewRow = {};
  listConfig.fields.forEach((f) => {
    emptyRow[f.name] = "";
  });
  delete emptyRow.rateofdowntime;
  const [newRow, setNewRow] = useState<NewRow>({ ...emptyRow });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // ── Fetch Items ───────────────────────────────────────────────────
  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const resp = await axios.get(
        `https://graph.microsoft.com/v1.0/sites/${siteId}` +
        `/lists/${listConfig.listId}/items?$expand=fields&$top=500`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setItems(
        resp.data.value.map((i: any) => {
          const fld = i.fields as Record<string, any>;
          const downtime = Number(fld.downtime) || 0;
          const prodMin  = Number(fld.productionminutes) || 0;
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

  // ── Static Ranges ─────────────────────────────────────────────────
  const yearsList = useMemo(
    () => Array.from({ length: 151 }, (_, i) => (2000 + i).toString()),
    []
  );
  const monthsList = useMemo(
    () => Array.from({ length: 12 }, (_, i) => (i + 1).toString()),
    []
  );
  const quartersList = useMemo(() => ["1", "2", "3", "4"], []);
  const yearsFilter = useMemo(() => ["All", ...yearsList], [yearsList]);
  const monthsFilter = useMemo(() => ["All", ...monthsList], [monthsList]);
  const quartersFilter = useMemo(() => ["All", ...quartersList], [quartersList]);

  // ── Filter & Pagination ────────────────────────────────────────────
  const filtered = useMemo(
    () =>
      items.filter((i) => {
        const yearMatch = filterYear === "All" || String(i.year) === filterYear;
        const monthMatch = filterMonth === "All" || String(i.Month) === filterMonth;
        const quarterMatch =
          filterQuarter === "All" || String(i.Quarter) === filterQuarter;
        return yearMatch && monthMatch && quarterMatch;
      }),
    [items, filterYear, filterMonth, filterQuarter]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  // ── Validation ────────────────────────────────────────────────────
  const validateNewRow = () => {
    const errs: Record<string, string> = {};
    listConfig.fields.forEach((f) => {
      if (f.name === "rateofdowntime") return;
      const v = newRow[f.name];
      if (f.type === "Number" && v !== "" && isNaN(Number(String(v).replace(",", ".")))) {
        errs[f.name] = `${f.name} must be a number`;
      }
    });
    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── CRUD ───────────────────────────────────────────────────────────

  const createItem = async () => {
    if (!validateNewRow()) return;
    setError(null);
    try {
      const token = await getToken();
      // normalize all numeric fields
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
        `https://graph.microsoft.com/v1.0/sites/${siteId}` +
        `/lists/${listConfig.listId}/items`,
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
        `https://graph.microsoft.com/v1.0/sites/${siteId}` +
        `/lists/${listConfig.listId}/items/${id}/fields`,
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
        `https://graph.microsoft.com/v1.0/sites/${siteId}` +
        `/lists/${listConfig.listId}/items/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchItems();
    } catch (e: any) {
      setError(e.message || "Delete failed");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="bg-white/10 border border-white/20 rounded-xl p-8 shadow-xl min-h-[80vh] space-y-6">
      {/* Header */}
      <h2 className="text-2xl font-bold text-white">{listConfig.name}</h2>
      {error && <p className="text-red-400">{error}</p>}

      {/* Add New Row Form */}
      <div className="bg-white/10 p-6 rounded-lg space-y-4">
        <h3 className="text-xl font-semibold text-white">Add New Row</h3>

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
            // skip the calculated field
            if (f.name === "rateofdowntime") return null;
            return (
              <div key={f.name} className="flex flex-col">
                <label className="text-sm font-medium text-white mb-1">
                  {f.label}
                </label>
                {["year","month","quarter"].includes(f.name.toLowerCase()) ? (
                  (() => {
                    const opts =
                      f.name.toLowerCase() === "year"
                        ? yearsList
                        : f.name.toLowerCase() === "month"
                        ? monthsList
                        : quartersList;
                    return (
                      <select
                        className="p-2 rounded bg-white/20 text-black"
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
                    );
                  })()
                ) : (
                  <input
                    type="text"
                    inputMode={f.type === "Number" ? "decimal" : undefined}
                    value={String(newRow[f.name] || "")}
                    onChange={(e) =>
                      setNewRow((r) => ({ ...r, [f.name]: e.target.value }))
                    }
                    className="p-2 rounded bg-white/20 text-black"
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
          className="mt-4 px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Save
        </button>
      </div>

      {/* Table Filters */}
      <div className="flex flex-wrap gap-4">
        <select
          className="p-2 rounded bg-white/20 text-white"
          value={filterYear}
          onChange={(e) => {
            setFilterYear(e.target.value);
            setPage(1);
          }}
        >
          {yearsFilter.map((y) => (
            <option key={y} value={y} className="text-black">
              {y === "All" ? "All Years" : y}
            </option>
          ))}
        </select>
        <select
          className="p-2 rounded bg-white/20 text-white"
          value={filterMonth}
          onChange={(e) => {
            setFilterMonth(e.target.value);
            setPage(1);
          }}
        >
          {monthsFilter.map((m) => (
            <option key={m} value={m} className="text-black">
              {m === "All" ? "All Months" : m}
            </option>
          ))}
        </select>
        <select
          className="p-2 rounded bg-white/20 text-white"
          value={filterQuarter}
          onChange={(e) => {
            setFilterQuarter(e.target.value);
            setPage(1);
          }}
        >
          {quartersFilter.map((q) => (
            <option key={q} value={q} className="text-black">
              {q === "All" ? "All Quarters" : q}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-white">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-white">
            <thead>
              <tr>
                {listConfig.fields.map((f) => (
                  <th
                    key={f.name}
                    className="border-b pb-2 text-left text-white"
                  >
                    {f.label}
                  </th>
                ))}
                <th className="border-b pb-2 text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((row) => (
                <tr key={row.id} className="border-t">
                  {listConfig.fields.map((f) => (
                    <td key={f.name} className="p-2">
                      {f.name === "rateofdowntime" ? (
                        <span>{row.rateofdowntime}</span>
                      ) : (
                        <input
                          type="text"
                          inputMode={f.type === "Number" ? "decimal" : undefined}
                          defaultValue={String(row[f.name] ?? "")}
                          onBlur={(e) =>
                            updateItem(row.id, f.name, e.target.value)
                          }
                          className="w-full p-1 rounded bg-white/20 text-black"
                        />
                      )}
                    </td>
                  ))}
                  <td className="p-2">
                    <button
                      onClick={() => deleteItem(row.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
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

      {/* Pagination */}
      <div className="flex justify-between items-center text-white">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="px-4 py-1 bg-gray-600 rounded disabled:opacity-50"
        >
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="px-4 py-1 bg-gray-600 rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
