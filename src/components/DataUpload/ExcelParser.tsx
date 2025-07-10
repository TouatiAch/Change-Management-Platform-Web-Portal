// src/components/ExcelParser.tsx

import React from "react";
import * as XLSX from "xlsx";

interface Props {
  onDataParsed: (data: any[], cleanedColumns: string[], rawColumns: string[]) => void;
  onProjectNameDetected: (name: string) => void;
  onLog: (msg: string) => void;
}

const columnMapping = {
  "ProcessnumberProcessinformation": "Processnumber",
  "StatusProcessinformation": "Status",
  "OEMProcessinformation": "OEM",
  "CarlineProcessinformation": "Carline",
  "ConstructedspaceProcessinformation": "Constructedspace",
  "HanddriversProcessinformation": "Handdrivers",
  "ProjectphaseProcessinformation": "Projectphase",
  "DeadlineTBTProcessinformation": "DeadlineTBT",
  "ModelyearProcessinformation": "Modelyear",
  "RealizationplannedProcessinformation": "Realizationplanned",
  "ApproxrealizationdateProcessinformation": "Approxrealizationdate",
  "StartdateProcessinformation": "StartdateProcessinfo",
  "EnddateProcessinformation": "EnddateProcessinfo",
  "OEMOfferChangenumberProcessinformation": "OEMOfferChangenumber",
  "OEMChangenumberProcessinformation": "OEMChangenumber",
  "ReasonforchangesProcessinformation": "Reasonforchanges",
  "StartdatePhase4": "StartdatePhase4",
  "EnddatePhase4": "EnddatePhase4",
  "StartdatePAVPhase4": "StartdatePAVPhase4",
  "EnddatePAVPhase4": "EnddatePAVPhase4",
  "EstimatedcostsPAVPhase4": "EstimatedcostsPAVPhase4",
  "ToolsutilitiesavailablePAVPhase4": "ToolsutilitiesavailablePAVPhase4",
  "ProcessFMEAPAVPhase4": "ProcessFMEAPAVPhase4",
  "PLPRelevantPAVPhase4": "PLPRelevantPAVPhase4",
  "RisklevelactualPAVPhase4": "RisklevelactualPAVPhase4",
  "changedate": "changedate",
  "StartdatePhase8": "StartdatePhase8",
  "EnddatePhase8": "EnddatePhase8",
  "NameChangepackagesPhase8": "Changepackages",
  "ProductsafetyrelevantProcessinformation": "ProductSafetyRelevant",
"EnddateLogisticPhase4": "EndDateLogisticPhase4",
"EnddateQSPhase4": "EndDateQSPhase4",
"EnddatePSCRPhase4": "EndDatePSCRPhase4",

};

const cleanHeader = (header: string): string => {
  return String(header).replace(/[^A-Za-z0-9]/g, "");
};

const calculateWorkingDays = (start: string, end: string): number | string => {
  try {
    const s = new Date(start);
    const e = new Date(end);
    let count = 0;
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) count++;
    }
    return count;
  } catch {
    return "";
  }
};

const parseProcessNumber = (val: string): string[] => {
  const match = val?.match(/^.*_(\d{4})_(\d{2})_(\d{2})_(\d{3})$/);
  return match ? match.slice(1) : ["", "", "", ""];
};

const getSheetName = (cs: string): string | string[] => {
  const val = cs?.trim();
  if (val === "Motorblock-Leitungssatz" || val === "MRA_(Motorraum)") return "MR";
  if (val === "COC (Cockpit)") return "Cockpit";
  if (val === "Innenraum") return "Innenraum";
  if (val === "Innenraum + COC (Cockpit)") return ["Cockpit", "Innenraum"];
  return "Autarke";
};

const ExcelParser: React.FC<Props> = ({ onDataParsed, onProjectNameDetected, onLog }) => {

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const workbook = XLSX.read(new Uint8Array(evt.target!.result as ArrayBuffer), { type: "array" });
      const sheetNames = workbook.SheetNames;

      // Extract column headers from first data sheet
const firstDataSheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetNames[1]], { header: 1 }) as any[][];
const rawHeaders: string[] = firstDataSheet[0] || [];
const cleanedColumns = rawHeaders.map((header) => cleanHeader(header));


      // Read parameters sheet
      const paramSheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetNames[0]], { header: 1 });
      const params: Record<string, string> = {};
      for (let i = 0; i < Math.min(paramSheet.length, 15); i++) {
        const row = paramSheet[i];
        if (!Array.isArray(row) || row.length < 2) continue;
        const [labelRaw, value] = row;
        const label = String(labelRaw).toLowerCase().trim();
        if (label.includes("oem")) {
          const cleanValue = String(value).trim();
          if (cleanValue && cleanValue !== "---") {
            params["OEM"] = cleanValue;
            onProjectNameDetected(cleanValue);
          }
        }
        if (label.includes("carline")) params["Carline"] = value;
        if (label.includes("start date from")) params["Start date from"] = value;
        if (label.includes("start date to")) params["Start date to"] = value;
      }
      const paramString = Object.entries(params).map(([k, v]) => `${k}: ${v}`).join(" | ");

      const allData: any[] = [];
      for (let i = 1; i < sheetNames.length; i++) {
        const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetNames[i]], { defval: "", raw: false });
        sheet.forEach((row) => {
          const mappedRow: any = {};
          const typedRow = row as Record<string, any>;

          Object.entries(typedRow).forEach(([k, v]) => {
            const cleanKey = cleanHeader(k);
            const mappedKey = (columnMapping as Record<string, string>)[cleanKey] || cleanKey;
            mappedRow[mappedKey] = v === "---" ? "" : v;
          });

          mappedRow["Parameters"] = paramString;
          allData.push(mappedRow);
        });
      }

      // Merge rows by Processnumber
      const grouped: Record<string, any[]> = {};
      for (const row of allData) {
        const key = row.Processnumber || "UNKNOWN";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(row);
      }

      const mergedData = Object.values(grouped).map((rows) => {
        const merged: any = {};
        for (const col of Object.keys(rows[0])) {
          const all = rows.map((r) => r[col]).filter((v) => v !== undefined && v !== "");
          merged[col] = [...new Set(all)].join(" | ");
        }

        const [year, month, day, pid] = parseProcessNumber(merged["Processnumber"]);
        merged["processyear"] = year;
        merged["processmonth"] = month;
        merged["processday"] = day;
        merged["processid"] = pid;

        ["Estimatedscrap", "Estimatedcost", "Estimateddowntime", "Estimatedchangedate", "Actualscrap", "Scrap", "Actualcost", "Actualdowntime", "Changedate"].forEach((col) => {
          merged[col] = "";
        });

        return merged;
      });

      const expandedData: any[] = [];
      for (const row of mergedData) {
        const sheetNameValues = getSheetName(row["Constructedspace"]);
        const base = { ...row };

       base.WorkingDaysProcess =
  base.StartdateProcessinfo && base.EnddateProcessinfo
    ? calculateWorkingDays(base.StartdateProcessinfo, base.EnddateProcessinfo)
    : "";

base.WorkingDaysPhase4 =
  base.StartdatePhase4 && base.EnddatePhase4
    ? calculateWorkingDays(base.StartdatePhase4, base.EnddatePhase4)
    : "";

base.WorkingDaysPAVPhase4 =
  base.StartdatePAVPhase4 && base.EnddatePAVPhase4
    ? calculateWorkingDays(base.StartdatePAVPhase4, base.EnddatePAVPhase4)
    : "";

base.WorkingDaysPAVPhase8 =
  base.StartdatePhase8 && base.EnddatePhase8
    ? calculateWorkingDays(base.StartdatePhase8, base.EnddatePhase8)
    : "";

        if (Array.isArray(sheetNameValues)) {
          for (const name of sheetNameValues) expandedData.push({ ...base, SheetName: name });
        } else {
          expandedData.push({ ...base, SheetName: sheetNameValues });
        }
      }

      // ✅ We now return both parsed data and extracted columns
      onDataParsed(expandedData, cleanedColumns, rawHeaders);

      onLog(`Processed ${expandedData.length} entries with column extraction complete.`);
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="excel-parser">
      <input type="file" accept=".xlsx" onChange={handleUpload} />
    </div>
  );
};

export default ExcelParser;
