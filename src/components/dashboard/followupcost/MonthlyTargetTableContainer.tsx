// src/components/dashboard/followupcost/MonthlyTargetTableContainer.tsx

import React, { useState, useEffect } from "react";
import axios from "axios";
import { getAccessToken } from "../../../auth/getToken";
import { msalInstance } from "../../../auth/msalInstance";
import { MonthlyTargetTable } from "./MonthlyTargetTable";

interface Props {
  siteId: string;
  listId: string;            // GUID or URL-encoded name of the MonthlyTargets list
  year: number;
  projects: string[];        // e.g. ["Mercedes-Benz","Lamborghini","draxlameir"]
}

interface Item {
  id: string;
  Project: string;
  Year: number;
  Month: number;
  Monthlytarget: number;
}

export const MonthlyTargetTableContainer: React.FC<Props> = ({
  siteId,
  listId,
  year,
  projects,
}) => {
  const DRAXL = "draxlameir";

  // ── State ──────────────────────────────────────────────
  const [token, setToken] = useState<string | null>(null);
  const [rawInputs, setRawInputs] = useState<Record<string,string[]>>({});
  const [numericTargets, setNumericTargets] = useState<Record<string,number[]>>({});
  const [itemIds, setItemIds] = useState<Record<string,(string|null)[]>>({});

  // ── 1) Authenticate ─────────────────────────────────────
  useEffect(() => {
    getAccessToken(msalInstance, ["https://graph.microsoft.com/Sites.ReadWrite.All"])
      .then(t => setToken(t))
      .catch(console.error);
  }, []);

  // ── 2) Fetch existing MonthlyTargets for this year ─────
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      // Prepare buffers
      const raw: Record<string,string[]> = {};
      const nums: Record<string,number[]> = {};
      const ids:  Record<string,(string|null)[]> = {};
      projects.forEach(p => {
        raw[p]  = Array(12).fill("");
        nums[p] = Array(12).fill(0);
        ids[p]  = Array(12).fill(null);
      });

      // Page through the list items
      let next = `https://graph.microsoft.com/v1.0/sites/${siteId}` +
                 `/lists/${encodeURIComponent(listId)}/items?expand=fields&$top=200`;
      while (next && !cancelled) {
        try {
          const resp = await axios.get(next, {
            headers: { Authorization: `Bearer ${token}` }
          });
          resp.data.value.forEach((it: any) => {
            const f = it.fields;
            const proj = f.Project as string;
            const y    = Number(f.Year) || year;
            const m    = Number(f.Month) || 1;
            const tgt  = Number(f.Monthlytarget) || 0;
            if (y === year && proj in raw) {
              raw[proj][m-1]      = tgt.toString();
              nums[proj][m-1]     = tgt;
              ids[proj][m-1]      = it.id;
            }
          });
          next = resp.data["@odata.nextLink"] || "";
        } catch (err) {
          console.error("Error fetching MonthlyTargets:", err);
          break;
        }
      }

      if (!cancelled) {
        setRawInputs(raw);
        setNumericTargets(nums);
        setItemIds(ids);
      }
    })();

    return () => { cancelled = true; };
  }, [token, siteId, listId, year, projects]);

  // ── 3) Handlers ─────────────────────────────────────────
  const onRawChange = (project: string, monthIdx: number, value: string) => {
    setRawInputs(prev => ({
      ...prev,
      [project]: prev[project].map((v,i) => i === monthIdx ? value : v)
    }));
  };

  const onCellBlur = async (project: string, monthIdx: number) => {
    if (!token) return;
    const raw = rawInputs[project][monthIdx].trim();
    const val = Number(raw) || 0;

    // Update numeric buffer immediately
    setNumericTargets(prev => ({
      ...prev,
      [project]: prev[project].map((v,i) => i === monthIdx ? val : v)
    }));

    // Build the exact fields payload
    const fieldsPayload = {
      Project:       project,
      Year:          year,
      Month:         monthIdx + 1,
      Monthlytarget: val,
    };

    const existingId = itemIds[project][monthIdx];

    try {
      if (existingId) {
        // ─── PATCH existing item ───────────────────────────
        await axios.patch(
          `https://graph.microsoft.com/v1.0/sites/${siteId}` +
          `/lists/${encodeURIComponent(listId)}` +
          `/items/${existingId}/fields`,
          fieldsPayload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
      } else {
        // ─── POST new item ──────────────────────────────────
        const resp = await axios.post(
          `https://graph.microsoft.com/v1.0/sites/${siteId}` +
          `/lists/${encodeURIComponent(listId)}/items`,
          { fields: fieldsPayload },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        const newId = resp.data.id as string;
        // Store the new ID for future PATCHes
        setItemIds(prev => ({
          ...prev,
          [project]: prev[project].map((v,i) => i === monthIdx ? newId : v)
        }));
      }
    } catch (err) {
      console.error("Failed to save Monthlytarget:", err);
    }
  };

  // ── 4) Render ───────────────────────────────────────────
  // Wait until rawInputs is initialized
  if (!rawInputs[projects[0]]) {
    return <p>Loading targets…</p>;
  }

  return (
    <MonthlyTargetTable
      projects={projects}
      rawInputs={rawInputs}
      numericTargets={numericTargets}
      onRawChange={onRawChange}
      onCellBlur={onCellBlur}
    />
  );
};
