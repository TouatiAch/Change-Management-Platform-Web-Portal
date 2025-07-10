import * as XLSX from "xlsx";
import { IPublicClientApplication } from "@azure/msal-browser";
import axios from "axios";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
export async function findListIdByName(
  siteId: string,
  listName: string,
  token: string
): Promise<string | null> {
  const url = `${GRAPH_BASE}/sites/${siteId}/lists?$filter=displayName eq '${listName}'`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) {
    console.error("[LIST_FIND_FAIL]", await resp.text());
    return null;
  }
  const data = await resp.json();
  return data?.value?.[0]?.id || null;
}

export async function getAccessToken(
  msalInstance: IPublicClientApplication
): Promise<string | null> {
  const accounts = msalInstance.getAllAccounts();
  if (!accounts.length) return null;
  const response = await msalInstance.acquireTokenSilent({
    account: accounts[0],
    scopes: ["https://graph.microsoft.com/.default"]
  });
  return response.accessToken;
}

export async function createSpList(
  siteId: string,
  listName: string,
  token: string
): Promise<string | null> {
  const url = `${GRAPH_BASE}/sites/${siteId}/lists`;
  const body = { displayName: listName, list: { template: "genericList" } };
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    console.error("[LIST_CREATE_FAIL]", await resp.text());
    return null;
  }
  const data = await resp.json();
  return data.id;
}

export async function getAllListItems(
  siteId: string,
  listId: string,
  token: string
): Promise<any[]> {
  let items: any[] = [];
  let next = `${GRAPH_BASE}/sites/${siteId}/lists/${listId}/items`;
  while (next) {
    const resp = await fetch(next, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) {
      console.error("[GET_ALL_ITEMS_FAIL]", await resp.text());
      break;
    }
    const json = await resp.json();
    items = items.concat(json.value);
    next = json["@odata.nextLink"];
  }
  return items;
}

export async function deleteAllItems(
  siteId: string,
  listId: string,
  token: string,
) {
  // 1) fetch all existing items
  const items = await getAllListItems(siteId, listId, token);
  const ids = items.map(i => i.id);

  // 2) bulk‐delete them
  if (ids.length) {
    await bulkDeleteItems(siteId, listId, token, ids, /* concurrency */ 2);
    console.log(`[BULK DELETED] ${ids.length} items`);
  }
}

export async function getExistingColumns(
  siteId: string,
  listId: string,
  token: string
): Promise<Record<string,string>> {
  const url = `${GRAPH_BASE}/sites/${siteId}/lists/${listId}/columns`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) {
    console.error("[GET_COLUMNS_FAIL]", await resp.text());
    return {};
  }
  const data = await resp.json();
  return data.value.reduce((map: Record<string,string>, col: any) => {
    map[col.displayName] = col.name;
    return map;
  }, {});
}

export async function createTextColumn(
  siteId: string,
  listId: string,
  displayName: string,
  token: string
): Promise<string | null> {
  const url = `${GRAPH_BASE}/sites/${siteId}/lists/${listId}/columns`;
  const body = { name: displayName, displayName, text: {} };
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    console.error(`[TEXT_COLUMN_FAIL] '${displayName}' =>`, await resp.text());
    return null;
  }
  const data = await resp.json();
  console.log(`[TEXT_COLUMN_CREATED] '${displayName}' => ${data.name}`);
  return data.name;
}

export async function createTextColumnWithRetry(
  siteId: string,
  listId: string,
  displayName: string,
  token: string,
  maxRetries = 3
): Promise<string | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const name = await createTextColumn(siteId, listId, displayName, token);
    if (name) return name;
    console.warn(`[RETRY ${attempt}/${maxRetries}] creating column '${displayName}'`);
    await new Promise(res => setTimeout(res, 2000));
  }
  console.error(`[GIVE UP] Could not create column '${displayName}'`);
  return null;
}
interface BatchReq {
  id: string;
  method: "POST" | "PATCH" | "DELETE";
  url: string;
  headers: Record<string,string>;
  body?: any;
}

async function uploadBatch(batch: BatchReq[], token: string) {
  const maxTries = 5;
  let attempt = 0;

  while (attempt++ < maxTries) {
    try {
      await axios.post(`${GRAPH_BASE}/$batch`, { requests: batch }, { headers: { Authorization: `Bearer ${token}` } });
      return;
    } catch (e: any) {
      const status = e.response?.status;
      if ([429, 503, 500].includes(status)) {
        const retryAfter = parseInt(e.response?.headers["retry-after"] || "5", 10);
        // ← capture here
        const currentAttempt = attempt;
        await new Promise(resolve =>
          setTimeout(resolve, retryAfter * 1000 * currentAttempt)
        );
        continue;
      }
      throw e;
    }
  }

  throw new Error("Batch permanently failed after retries");
}

async function limitedMap<T>(
  batches: T[][],
  concurrency: number,
  fn: (batch: T[]) => Promise<void>
) {
  let idx = 0;
  const workers = Array(concurrency).fill(0).map(async () => {
    while (idx < batches.length) {
      const i = idx++;
      await fn(batches[i]);
    }
  });
  await Promise.all(workers);
}

export async function bulkCreateItems(
  siteId: string,
  listId: string,
  token: string,
  items: Array<{fields: Record<string, any>}>,
  concurrency = 2
) {
  const reqs: BatchReq[] = items.map((it, i) => ({
    id: `${i}`,
    method: "POST",
    url: `/sites/${siteId}/lists/${listId}/items`,
    headers: { "Content-Type": "application/json" },
    body: { fields: it.fields }
  }));

  const batches = chunkArray(reqs, 20);
  await limitedMap(batches, concurrency, batch => uploadBatch(batch, token));
}
/**
 * Bulk‐deletes up to 20 items per Graph batch.
 */
export async function bulkDeleteItems(
  siteId: string,
  listId: string,
  token: string,
  itemIds: string[],
  concurrency = 2,
) {
  // 1) build one DELETE request entry per item
  const reqs = itemIds.map((itemId, i) => ({
    id: `${i}`,
    method: "DELETE" as const,
    // note: must start with a leading slash
    url: `/sites/${siteId}/lists/${listId}/items/${itemId}`,
    headers: {},       // no Content-Type needed for DELETE
  }));

  // 2) batch into chunks of ≤20
  const batches = chunkArray(reqs, 20);

  // 3) fire them off in parallel
  await limitedMap(batches, concurrency, batch => uploadBatch(batch, token));
}

export async function insertItem(
  siteId: string,
  listId: string,
  fieldsMap: Record<string,string>,
  token: string,
  rowNum = 0
): Promise<string | null> {
  const url = `${GRAPH_BASE}/sites/${siteId}/lists/${listId}/items`;
  const body = { fields: { Title: `Row_${rowNum}`, ...fieldsMap } };
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    console.error(`[ITEM_CREATE_FAIL]`, await resp.text());
    return null;
  }
  const js = await resp.json();
  console.log(`[ITEM_CREATED] ID: ${js.id}`);
  return js.id;
}
export async function processDataframe(
  df: any,
  projectName: string,
  phase: string,
  siteId: string,
  token: string
): Promise<void> {
  const listName = `changes_${projectName.trim()}_${phase.trim()}`;
  console.log(`[UPLOAD_START] To SharePoint List: '${listName}'`);

  let listId = await findListIdByName(siteId, listName, token);
  if (!listId) {
    listId = await createSpList(siteId, listName, token);
    if (!listId) throw new Error(`Failed to create list ${listName}`);
    console.log(`[NEW LIST CREATED] ${listName}`);
  } else {
    console.log(`[EXISTING LIST FOUND] ${listName}`);
    await deleteAllItems(siteId, listId, token);
  }

  const existingCols = await getExistingColumns(siteId, listId, token);
  const finalCols: string[] = [];
  for (const col of df.columns) {
    if (existingCols[col]) {
      finalCols.push(col);
    } else {
      const intName = await createTextColumnWithRetry(siteId, listId, col, token);
      if (intName) finalCols.push(col);
    }
  }

  const worksheet = XLSX.utils.json_to_sheet(df);
  const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet);

  const items = jsonData.map((row, idx) => {
    const fieldsMap: Record<string, any> = {};
    for (const col of finalCols) {
      let val = row[col];
      if (val === undefined || val === null || val === "---") val = "";
      fieldsMap[col] = String(val);
    }
    return { fields: fieldsMap };
  });

  await bulkCreateItems(siteId, listId, token, items, 2);
  console.log(`[DONE] Bulk‐uploaded ${items.length} rows to '${listName}'`);
}
export async function resolveSiteIdFromUrl(
  siteUrl: string,
  token: string
): Promise<{ siteId: string | null; isPersonal: boolean }> {
  try {
    const parsed = new URL(siteUrl);
    const hostname = parsed.hostname;
    let path = parsed.pathname.replace(/^\/+|\/+$/g, "");

    let graphUrl = "";
    let isPersonal = false;
    if (path.startsWith("sites/")) {
      path = path.replace(/^sites\//, "");
      graphUrl = `${GRAPH_BASE}/sites/${hostname}:/sites/${path}`;
    } else {
      console.error(`[SITE_ID_FAIL] Unsupported URL: ${siteUrl}`);
      return { siteId: null, isPersonal: false };
    }

    const resp = await fetch(graphUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) {
      console.error("[SITE_ID_FAIL]", await resp.text());
      return { siteId: null, isPersonal: false };
    }
    const data = await resp.json();
    console.log(`[SITE_ID_RESOLVED] => ${data.id}`);
    return { siteId: data.id, isPersonal };
  } catch (err: any) {
    console.error("[SITE_ID_FAIL]", err.message);
    return { siteId: null, isPersonal: false };
  }
}
