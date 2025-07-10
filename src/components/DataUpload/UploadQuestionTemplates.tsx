import React, { useState } from "react";
import * as XLSX from "xlsx";
import axios from "axios";
import { getAccessToken } from "../../auth/getToken";
import { msalInstance } from "../../auth/msalInstance";
import { getConfig } from "../../services/configService";
import { deleteAllItems } from "../../services/sharepointService";


interface Props {
  siteId: string;
  onLog: (msg: string) => void;
  onComplete: () => void;
}

const UploadQuestionTemplates: React.FC<Props> = ({ siteId, onLog, onComplete }) => {
  const [status, setStatus] = useState("");
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [uploadReady, setUploadReady] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setStatus("Reading Excel file...");
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const parsed = XLSX.utils.sheet_to_json(worksheet);

      if (!parsed.length) throw new Error("Excel is empty or improperly formatted.");

      setParsedRows(parsed);
      setUploadReady(true);
      setStatus("✅ Preview ready. Click Upload to continue.");
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Failed to read Excel: ${err.message}`);
    }
  };

  const handleUpload = async () => {
    try {
      setStatus("Uploading to SharePoint...");
      const token = await getAccessToken(msalInstance, ["Sites.ReadWrite.All"]);
      const config = getConfig();
      const listId = config.questionsListId;
      const resolvedSiteId = config.siteId;

      if (!listId || !resolvedSiteId) throw new Error("Missing configuration for SharePoint site or list.");

     if (!listId) throw new Error("Missing questions list ID");
if (!token) throw new Error("Missing access token");
await deleteAllItems(resolvedSiteId, listId, token);


      onLog("🧹 Cleared old QuestionTemplates items.");

      for (const [index, row] of parsedRows.entries()) {
        const r = row as Record<string, any>;
        const fields = {
          Questionid: `q${index + 1}`,
          Question: r["Questions"] || "",
          TriggerOn: r["TriggerOn"] || "Oui",
          Action: r["Action"] || "",
          Responsiblerole: r["Responsiblerole"] || "",
          ResponsableEmail: "",
          SendIntervalValue: 3,
          SendIntervalUnit: "Days",
          emailbody: "",
          emailsubject: "",
        };

        await axios.post(
          `https://graph.microsoft.com/v1.0/sites/${resolvedSiteId}/lists/${listId}/items`,
          { fields },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      setStatus("✅ Upload complete!");
      onLog("✅ Question templates uploaded successfully.");
      onComplete();
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Upload failed: ${err.message}`);
      onLog(`❌ Upload failed: ${err.message}`);
    }
  };

  return (
    <div className="bg-white text-black p-6 rounded-xl shadow max-w-3xl mx-auto mt-10 space-y-4">
      <h2 className="text-2xl font-bold text-center">Upload Question Templates</h2>
      <input type="file" accept=".xlsx" onChange={handleFileUpload} className="w-full" />
      {status && <p className="mt-2 text-sm font-medium">{status}</p>}

      {parsedRows.length > 0 && (
        <div className="overflow-x-auto max-h-80 border rounded mt-4">
          <table className="min-w-full border-collapse">
            <thead className="bg-gray-100 text-sm sticky top-0">
              <tr>
                {Object.keys(parsedRows[0]).map((key) => (
                  <th key={key} className="px-2 py-1 border text-left">{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsedRows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {Object.values(row).map((val, j) => (
                    <td key={j} className="px-2 py-1 border">{String(val ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {uploadReady && (
        <button
          onClick={handleUpload}
          className="w-full mt-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Upload to SharePoint
        </button>
      )}
    </div>
  );
};

export default UploadQuestionTemplates;
