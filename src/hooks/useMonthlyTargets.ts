// src/hooks/useMonthlyTargets.ts
import { useState, useEffect } from "react";
import axios from "axios";
import { getAccessToken } from "../auth/getToken";
import { msalInstance } from "../auth/msalInstance";

export function useMonthlyTargets(
  siteId: string,
  listId: string,
  year: number,
  projects: string[]
) {
  const [map, setMap] = useState<Record<string, Record<string,number>>>({});
  useEffect(() => {
    let cancel = false;
    (async () => {
      const token = await getAccessToken(msalInstance, ["Sites.Read.All"]);
      let acc: Record<string,Record<string,number>> = {};
      projects.forEach(p => (acc[p] = {}));

      let next = `https://graph.microsoft.com/v1.0/sites/${siteId}` +
                 `/lists/${encodeURIComponent(listId)}/items?expand=fields&$top=200`;
      while (next && !cancel) {
        const resp = await axios.get(next, {
          headers: { Authorization: `Bearer ${token}` }
        });
        resp.data.value.forEach((it: any) => {
          const f = it.fields;
          const proj = f.Project;
          const y    = Number(f.Year);
          const m    = String(f.Month).padStart(2, "0");
          const tgt  = Number(f.Monthlytarget) || 0;
          if (y === year && acc[proj]) {
            acc[proj][`${year}-${m}`] = tgt;
          }
        });
        next = resp.data["@odata.nextLink"] || "";
      }
      if (!cancel) setMap(acc);
    })();
    return () => { cancel = true; };
  }, [siteId, listId, year, projects]);

  return map;
}
