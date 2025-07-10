// File: src/pages/FollowCostKPIEditor.tsx

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { getAccessToken } from "../auth/getToken";
import { msalInstance } from "../auth/msalInstance";
import harnessBg from "../assets/images/harness-bg.png";
import ProjectCarousel from "../components/ProjectCarousel";
import TopMenu from "../components/TopMenu";

interface IFollowCostFields {
  Project: string;
  Area: string;
  Carline: string;
  InitiationReasons: string;
  BucketID: string;
  Date: string;
  Statut: string;
  Quantity: number;
  NettValue: number;
  TotalNettValue: number;
  Currency: string;
  BucketResponsible: string;
  PostnameID: string;
  Topic: string;
}

interface IFollowCostKPIItem {
  id: string;
  fields: IFollowCostFields;
}

interface IEditorRow {
  isEditing: boolean;
  draft: IFollowCostFields;
}

const LISTS_CONFIG_KEY = "cmConfigLists";

const FollowCostKPIEditor: React.FC = () => {
  const [siteId, setSiteId] = useState("");
  const [listId, setListId] = useState("");
  const [allItems, setAllItems] = useState<IFollowCostKPIItem[]>([]);
  const [items, setItems] = useState<IFollowCostKPIItem[]>([]);
  const [editorState, setEditorState] = useState<Record<string, IEditorRow>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const navigate = useNavigate();

  // 1) Load siteId & listId from localStorage
  useEffect(() => {
    const raw = localStorage.getItem(LISTS_CONFIG_KEY);
    if (!raw) return;
    try {
      const cfg = JSON.parse(raw);
      if (cfg.siteId) setSiteId(cfg.siteId);
      if (cfg.followCostListId) setListId(cfg.followCostListId);
    } catch {}
  }, []);

  // 2) Fetch all items
  useEffect(() => {
    if (!siteId || !listId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken(msalInstance, [
          "https://graph.microsoft.com/Sites.Manage.All",
        ]);
        const resp = await axios.get(
          `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?expand=fields`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setAllItems(resp.data.value || []);
      } catch (err: any) {
        setError(err.message || "Failed to load items.");
      } finally {
        setLoading(false);
      }
    })();
  }, [siteId, listId]);

  // 3) Filter by project
  useEffect(() => {
    if (!selectedProject) {
      setItems(allItems);
    } else {
      setItems(
        allItems.filter((it) => it.fields.Project === selectedProject)
      );
    }
    setCurrentPage(1);
  }, [selectedProject, allItems]);

  // Pagination
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedItems = items.slice(startIdx, startIdx + itemsPerPage);
  const pageCount = Math.ceil(items.length / itemsPerPage);

  // Editing handlers
  const handleRowDoubleClick = (item: IFollowCostKPIItem) => {
    setEditorState((prev) => ({
      ...prev,
      [item.id]: { isEditing: true, draft: { ...item.fields } },
    }));
  };
  const handleEditFieldChange = (
    itemId: string,
    field: keyof IFollowCostFields,
    value: string | number
  ) => {
    setEditorState((prev) => {
      const row = prev[itemId];
      if (!row) return prev;
      return {
        ...prev,
        [itemId]: {
          ...row,
          draft: { ...row.draft, [field]: value },
        },
      };
    });
  };
  const handleCancel = (itemId: string) => {
    setEditorState((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], isEditing: false },
    }));
  };
  const handleSave = async (itemId: string) => {
    const row = editorState[itemId];
    if (!row) return;
    const allowed: (keyof IFollowCostFields)[] = [
      "Project","Area","Carline","InitiationReasons","BucketID",
      "Date","Statut","Quantity","NettValue","TotalNettValue",
      "Currency","BucketResponsible","PostnameID","Topic",
    ];
    const draft = { ...row.draft };
    if (draft.Date.includes("T")) draft.Date = draft.Date.slice(0, 10);
    const fields = allowed.reduce((acc, k) => {
      (acc as any)[k] = draft[k];
      return acc;
    }, {} as Partial<IFollowCostFields>);

    try {
      const token = await getAccessToken(msalInstance, [
        "https://graph.microsoft.com/Sites.Manage.All",
      ]);
      await axios.patch(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${itemId}/fields`,
        fields,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // update locally
      setItems((prev) =>
        prev.map((it) =>
          it.id === itemId ? { ...it, fields: { ...it.fields, ...fields } } : it
        )
      );
      handleCancel(itemId);
    } catch (err: any) {
      alert("Error saving: " + (err.response?.data?.error?.message || err.message));
    }
  };
  const handleDelete = async (itemId: string) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      const token = await getAccessToken(msalInstance, [
        "https://graph.microsoft.com/Sites.Manage.All",
      ]);
      await axios.delete(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${itemId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setItems((prev) => prev.filter((it) => it.id !== itemId));
      setEditorState((prev) => {
        const nxt = { ...prev };
        delete nxt[itemId];
        return nxt;
      });
    } catch (err: any) {
      alert("Error deleting: " + (err.response?.data?.error?.message || err.message));
    }
  };

  return (
    <div
      className="relative w-full min-h-screen bg-cover bg-center text-white"
      style={{ backgroundImage: `url(${harnessBg})` }}
    >
      {/* Top bar: highest z-index */}
      <div className="relative z-50 max-w-6xl mx-auto p-4 flex items-center space-x-4">
        <TopMenu />
        <button
          onClick={() => navigate(-1)}
          className="px-3 py-2 bg-white/20 hover:bg-white/30 backdrop-blur rounded-2xl text-white text-sm"
        >
          ← Back
        </button>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 pb-8">
        <h1 className="text-2xl font-semibold mb-4">FollowCost KPI Editor</h1>

        {/* Project filter carousel */}
        <ProjectCarousel
          projects={
            JSON.parse(localStorage.getItem(LISTS_CONFIG_KEY) || "{}").projects ||
            []
          }
          selectedProject={selectedProject}
          onProjectSelect={setSelectedProject}
        />

        <div className="mt-6 bg-white/10 border border-white/20 p-6 rounded-xl shadow-xl">
          {loading && <p>Loading items...</p>}
          {error && <p className="text-red-400">{error}</p>}
          {!loading && !error && items.length === 0 && <p>No items found.</p>}

          {paginatedItems.length > 0 && (
            // Horizontal scroll wrapper
            <div className="overflow-x-auto">
              {/* Vertical scroll + sticky header */}
              <div className="overflow-y-auto max-h-[60vh]">
                <table className="min-w-[1200px] w-full table-auto divide-y divide-white/20 text-white text-sm">
                  <thead>
                    <tr className="bg-white/20 sticky top-0 z-20">
                      <th className="p-2 text-left">Actions</th>
                      <th className="p-2 text-left">Project</th>
                      <th className="p-2 text-left">Area</th>
                      <th className="p-2 text-left">Carline</th>
                      <th className="p-2 text-left">InitiationReasons</th>
                      <th className="p-2 text-left">BucketID</th>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Statut</th>
                      <th className="p-2 text-right">Quantity</th>
                      <th className="p-2 text-right">NettValue</th>
                      <th className="p-2 text-right">TotalNettValue</th>
                      <th className="p-2 text-left">Currency</th>
                      <th className="p-2 text-left">BucketResponsible</th>
                      <th className="p-2 text-left">PostnameID</th>
                      <th className="p-2 text-left">Topic</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white/5">
                    {paginatedItems.map((itm) => {
                      const row = editorState[itm.id];
                      const editing = row?.isEditing;
                      return (
                        <tr
                          key={itm.id}
                          onDoubleClick={() => handleRowDoubleClick(itm)}
                          className="even:bg-white/10 hover:bg-white/20 cursor-pointer transition-colors"
                        >
                          <td className="p-2 whitespace-nowrap">
                            {editing ? (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSave(itm.id);
                                  }}
                                  className="px-2 py-1 bg-green-500 rounded text-sm"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancel(itm.id);
                                  }}
                                  className="ml-2 px-2 py-1 bg-gray-500 rounded text-sm"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRowDoubleClick(itm);
                                  }}
                                  className="px-2 py-1 bg-blue-500 rounded text-sm"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(itm.id);
                                  }}
                                  className="ml-2 px-2 py-1 bg-red-500 rounded text-sm"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </td>
                          {/* Each field cell */}
                          <td className="p-2">
                            {editing ? (
                              <input
                                className="border p-1 w-24 text-black"
                                value={row?.draft.Project}
                                onChange={(e) =>
                                  handleEditFieldChange(itm.id, "Project", e.target.value)
                                }
                              />
                            ) : (
                              itm.fields.Project
                            )}
                          </td>
                          <td className="p-2">
                            {editing ? (
                              <input
                                className="border p-1 w-20 text-black"
                                value={row?.draft.Area}
                                onChange={(e) =>
                                  handleEditFieldChange(itm.id, "Area", e.target.value)
                                }
                              />
                            ) : (
                              itm.fields.Area
                            )}
                          </td>
                          <td className="p-2">
                            {editing ? (
                              <input
                                className="border p-1 w-24 text-black"
                                value={row?.draft.Carline}
                                onChange={(e) =>
                                  handleEditFieldChange(itm.id, "Carline", e.target.value)
                                }
                              />
                            ) : (
                              itm.fields.Carline
                            )}
                          </td>
                          <td className="p-2">
                            {editing ? (
                              <input
                                className="border p-1 w-32 text-black"
                                value={row?.draft.InitiationReasons}
                                onChange={(e) =>
                                  handleEditFieldChange(
                                    itm.id,
                                    "InitiationReasons",
                                    e.target.value
                                  )
                                }
                              />
                            ) : (
                              itm.fields.InitiationReasons
                            )}
                          </td>
                          <td className="p-2">
                            {editing ? (
                              <input
                                className="border p-1 w-24 text-black"
                                value={row?.draft.BucketID}
                                onChange={(e) =>
                                  handleEditFieldChange(itm.id, "BucketID", e.target.value)
                                }
                              />
                            ) : (
                              itm.fields.BucketID
                            )}
                          </td>
                          <td className="p-2">
                            {editing ? (
                              <input
                                type="date"
                                className="border p-1 w-28 text-black"
                                value={row?.draft.Date}
                                onChange={(e) =>
                                  handleEditFieldChange(itm.id, "Date", e.target.value)
                                }
                              />
                            ) : (
                              itm.fields.Date
                            )}
                          </td>
                          <td className="p-2">
                            {editing ? (
                              <input
                                className="border p-1 w-24 text-black"
                                value={row?.draft.Statut}
                                onChange={(e) =>
                                  handleEditFieldChange(itm.id, "Statut", e.target.value)
                                }
                              />
                            ) : (
                              itm.fields.Statut
                            )}
                          </td>
                          <td className="p-2 text-right">
                            {editing ? (
                              <input
                                type="number"
                                className="border p-1 w-16 text-black"
                                value={row?.draft.Quantity}
                                onChange={(e) =>
                                  handleEditFieldChange(
                                    itm.id,
                                    "Quantity",
                                    Number(e.target.value)
                                  )
                                }
                              />
                            ) : (
                              itm.fields.Quantity
                            )}
                          </td>
                          <td className="p-2 text-right">
                            {editing ? (
                              <input
                                type="number"
                                className="border p-1 w-20 text-black"
                                value={row?.draft.NettValue}
                                onChange={(e) =>
                                  handleEditFieldChange(
                                    itm.id,
                                    "NettValue",
                                    Number(e.target.value)
                                  )
                                }
                              />
                            ) : (
                              itm.fields.NettValue
                            )}
                          </td>
                          <td className="p-2 text-right">
                            {editing ? (
                              <input
                                type="number"
                                className="border p-1 w-24 text-black"
                                value={row?.draft.TotalNettValue}
                                onChange={(e) =>
                                  handleEditFieldChange(
                                    itm.id,
                                    "TotalNettValue",
                                    Number(e.target.value)
                                  )
                                }
                              />
                            ) : (
                              itm.fields.TotalNettValue
                            )}
                          </td>
                          <td className="p-2">
                            {editing ? (
                              <input
                                className="border p-1 w-20 text-black"
                                value={row?.draft.Currency}
                                onChange={(e) =>
                                  handleEditFieldChange(itm.id, "Currency", e.target.value)
                                }
                              />
                            ) : (
                              itm.fields.Currency
                            )}
                          </td>
                          <td className="p-2">
                            {editing ? (
                              <input
                                className="border p-1 w-28 text-black"
                                value={row?.draft.BucketResponsible}
                                onChange={(e) =>
                                  handleEditFieldChange(
                                    itm.id,
                                    "BucketResponsible",
                                    e.target.value
                                  )
                                }
                              />
                            ) : (
                              itm.fields.BucketResponsible
                            )}
                          </td>
                          <td className="p-2">
                            {editing ? (
                              <input
                                className="border p-1 w-28 text-black"
                                value={row?.draft.PostnameID}
                                onChange={(e) =>
                                  handleEditFieldChange(itm.id, "PostnameID", e.target.value)
                                }
                              />
                            ) : (
                              itm.fields.PostnameID
                            )}
                          </td>
                          <td className="p-2">
                            {editing ? (
                              <input
                                className="border p-1 w-32 text-black"
                                value={row?.draft.Topic}
                                onChange={(e) =>
                                  handleEditFieldChange(itm.id, "Topic", e.target.value)
                                }
                              />
                            ) : (
                              itm.fields.Topic
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex mt-4 space-x-2 justify-center">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-white/20 rounded disabled:opacity-50"
              >
                Prev
              </button>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((pg) => (
                <button
                  key={pg}
                  onClick={() => setCurrentPage(pg)}
                  className={`px-3 py-1 rounded ${
                    pg === currentPage
                      ? "bg-blue-500 text-white"
                      : "bg-white/20 hover:bg-white/30"
                  }`}
                >
                  {pg}
                </button>
              ))}
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, pageCount))
                }
                disabled={currentPage === pageCount}
                className="px-3 py-1 bg-white/20 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FollowCostKPIEditor;
