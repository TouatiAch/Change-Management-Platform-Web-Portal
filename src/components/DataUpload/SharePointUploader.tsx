import React, { useState } from "react";

import uploadIcon from "../../assets/images/uploadIcon.png";
import axios from "axios";
import { getAccessToken } from "../../auth/getToken";
import { msalInstance } from "../../auth/msalInstance";
import { bulkCreateItems, createSpList, createTextColumnWithRetry, deleteAllItems, findListIdByName, getAllListItems, getExistingColumns } from "../../services/sharepointService";
import { getConfig } from "../../services/configService";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const scopes = ["Sites.ReadWrite.All", "Sites.Manage.All"];

interface Props {
  data: any[];
  phase: string;
  projectName: string;
  siteId: string | null;
  isPersonal: boolean;
  siteUrl: string;
  onLog: (msg: string) => void;
  onUploadComplete: () => void;
}

const SharePointUploader: React.FC<Props> = ({
  data,
  phase,
  projectName,
  siteId,
  onLog,
  onUploadComplete,
}) => {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");

  const handleUpload = async () => {
    if (!data.length || !projectName || !siteId) {
      setStatus("Missing data, project name, or site ID.");
      return;
    }
    setUploading(true);

    try {
      // ─── 1️⃣ Authenticate ───────────────────────────────────────────
      const token = await getAccessToken(msalInstance, scopes);
      if (!token) throw new Error("Token acquisition failed.");

      // ─── 2️⃣ Prepare “changes” list ─────────────────────────────────
      const changesName = `changes_${projectName.trim()}_${phase.trim()}`;
      onLog(`🔧 Preparing list: ${changesName}`);
      let changesId = await findListIdByName(siteId, changesName, token);
      if (!changesId) {
        onLog("➕ Creating changes list…");
        changesId = await createSpList(siteId, changesName, token);
      }
      if (!changesId) throw new Error(`Cannot find/create '${changesName}'`);

      // Clear existing items
      const beforeRaw = await getAllListItems(siteId, changesId, token);
      onLog(`🗑️ Deleting ${beforeRaw.length} existing change items`);
      await deleteAllItems(siteId, changesId, token);

      // Ensure columns exist
      const existingRawCols = await getExistingColumns(
        siteId,
        changesId,
        token
      );
      const displayCols = Object.keys(data[0]);
      onLog(`📑 Data columns: [${displayCols.join(", ")}]`);
      for (const col of displayCols) {
        if (!existingRawCols[col]) {
          await createTextColumnWithRetry(siteId, changesId, col, token);
        }
      }

      // ─── 3️⃣ Bulk‐insert raw rows ────────────────────────────────────
      onLog(`📤 Bulk‐inserting ${data.length} raw change rows…`);
      const rawItems = data.map((row, i) => {
        const fields: Record<string, string> = { Title: `Row_${i + 1}` };
        for (const col of displayCols) {
          fields[col] = row[col] === "---" ? "" : String(row[col] ?? "");
        }
        return { fields };
      });
      await bulkCreateItems(siteId, changesId, token, rawItems, 2);
      onLog(`✅ Raw upload complete: ${data.length}/${data.length}`);

      // ─── 4️⃣ Fetch QuestionTemplates ─────────────────────────────────
      const cfg = getConfig();
      const qListId = cfg.questionsListId;
      if (!qListId) {
        onLog("⚠️ No QuestionTemplates configured—skipping CQS");
        onUploadComplete();
        return;
      }
      onLog("🔍 Fetching QuestionTemplates…");
      const tmplResp = await axios.get(
        `${GRAPH_BASE}/sites/${siteId}/lists/${qListId}/items?$top=1000&expand=fields`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const rawTemplates = tmplResp.data.value.map((it: any) => it.fields);
      const templates = rawTemplates.filter((f: any) => !!f.Questionid);
      onLog(`✅ Valid templates: ${templates.length}`);
      if (!templates.length) {
        onLog("⚠️ No valid templates—skipping CQS");
        onUploadComplete();
        return;
      }

      // ─── 5️⃣ Build change–area mapping ───────────────────────────────
      const changeAreaList = data.map((r) => ({
        change: r.Processnumber,
        area: r.SheetName,
      }));

      // ─── 6️⃣ Prepare & clear CQS list ────────────────────────────────
      const cqsName = `ChangeQuestionStatus_${projectName.trim()}`;
      onLog(`🔧 Preparing CQS list: ${cqsName}`);
      let cqsId = await findListIdByName(siteId, cqsName, token);
      if (!cqsId) {
        onLog("➕ Creating CQS list…");
        cqsId = await createSpList(siteId, cqsName, token);
      }
      if (!cqsId) throw new Error(`Cannot find/create '${cqsName}'`);

      const neededCols = [
        "ChangeNumber",
        "QuestionId",
        "Area",
        "responseReceived",
        "lastSent",
        "lastChecked",
        "conversationId",
        "internetMessageId",
        "Question",
        "TriggerOn",
        "ResponsableEmail",
        "SendIntervalValue",
        "SendIntervalUnit",
        "Action",
        "Responsiblerole",
        "emailbody",
        "emailsubject",
        "replySubject",
        "replyBody",
        "replyReceivedDate",
      ];
      const existingCqsCols = await getExistingColumns(siteId, cqsId, token);
      for (const col of neededCols) {
        if (!existingCqsCols[col]) {
          await createTextColumnWithRetry(siteId, cqsId, col, token);
          onLog(`➕ Created CQS column '${col}'`);
        }
      }
      const cqsColMap = await getExistingColumns(siteId, cqsId, token);

      const beforeCqs = await getAllListItems(siteId, cqsId, token);
      onLog(`🗑️ Deleting ${beforeCqs.length} existing CQS items`);
      await deleteAllItems(siteId, cqsId, token);

      // ─── 7️⃣ Bulk‐insert CQS rows ────────────────────────────────────
      const totalCqs = changeAreaList.length * templates.length;
      onLog(`📤 Bulk‐inserting ${totalCqs} CQS rows…`);
      const cqsItems: Array<{ fields: Record<string, string> }> = [];

      for (const { change, area } of changeAreaList) {
        for (const t of templates) {
          const fields: Record<string, string> = {
            Title: `${change}-${t.Questionid}`,
            [cqsColMap["ChangeNumber"]]: String(change),
            [cqsColMap["Area"]]: String(area),
            [cqsColMap["QuestionId"]]: String(t.Questionid),
            [cqsColMap["responseReceived"]]: "false",
            [cqsColMap["lastSent"]]: "",
            [cqsColMap["lastChecked"]]: "",
            [cqsColMap["conversationId"]]: "",
            [cqsColMap["internetMessageId"]]: "",
            [cqsColMap["Question"]]: t.Question || "",
            [cqsColMap["TriggerOn"]]: t.TriggerOn || "",
            [cqsColMap["ResponsableEmail"]]: t.ResponsableEmail || "",
            [cqsColMap["SendIntervalValue"]]: String(
              t.SendIntervalValue ?? ""
            ),
            [cqsColMap["SendIntervalUnit"]]: t.SendIntervalUnit || "",
            [cqsColMap["Action"]]: t.Action || "",
            [cqsColMap["Responsiblerole"]]: t.Responsiblerole || "",
            [cqsColMap["emailbody"]]: t.emailbody || "",
            [cqsColMap["emailsubject"]]: t.emailsubject || "",
          };
          cqsItems.push({ fields });
        }
      }
      await bulkCreateItems(siteId, cqsId, token, cqsItems, 2);
      onLog(`✅ Completed CQS upload: ${cqsItems.length}/${cqsItems.length}`);

      onUploadComplete();
    } catch (err: any) {
      setStatus(`❌ Upload failed: ${err.message}`);
      onLog(`❌ Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4 flex flex-col items-center">
      <button
        onClick={handleUpload}
        disabled={uploading}
        className="w-72 h-72 bg-white/20 backdrop-blur-md rounded-2xl shadow-lg hover:bg-white/30 hover:scale-105 transition-transform duration-300 ease-in-out flex flex-col items-center justify-center text-white"
      >
        <img
          src={uploadIcon}
          alt="Upload"
          className="h-48 w-38 mb-6 object-contain"
        />
        <span className="text-xl font-semibold">
          {uploading ? "Uploading..." : "Upload to SharePoint"}
        </span>
      </button>
      {status && (
        <p
          className={`text-sm ${
            status.startsWith("✅")
              ? "text-green-400"
              : status.startsWith("❌")
              ? "text-red-400"
              : "text-yellow-200"
          }`}
        >
          {status}
        </p>
      )}
    </div>
  );
};

export default SharePointUploader;
