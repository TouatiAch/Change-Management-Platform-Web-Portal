import React, { useEffect } from "react";

interface Props {
  actualColumnsRaw: string[];
  actualColumnsCleaned: string[];
  onValidationResult: (isValid: boolean) => void;
}

const expectedHeadersRaw = [
  "Status - Process information",
  "OEM - Process information",
  "Carline - Process information",
  "Constructed space - Process information",
  "Hand drivers - Process information",
  "Project phase - Process information",
  "Deadline TBT - Process information",
  "Model year - Process information",
  "Realization planned - Process information",
  "Approx. realization date - Process information",
  "Start date - Process information",
  "End date - Process information",
  "Process number - Process information",
  "OEM-Offer-/ Change number - Process information",
  "OEM-Change number - Process information",
  "Reason for changes - Process information",
  "Start date - Phase4",
  "End date - Phase4",
  "Start date - PAV - Phase4",
  "End date - PAV - Phase4",
  "Estimated costs - PAV - Phase4",
  "Tools / utilities available - PAV - Phase4",
  "Process - FMEA - PAV - Phase4",
  "PLP Relevant - PAV - Phase4",
  "Risk level actual - PAV - Phase4",
  "Start date - Phase8",
  "End date - Phase8",
  "Name - Change packages - Phase8",
   "Product safety relevant - Process information",
  "End date - Logistic - Phase4",
  "End date - QS - Phase4",
  "End date - PSCR - Phase4"
];

const normalizeHeader = (header: string): string => {
  return header.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
};

const ColumnValidator: React.FC<Props> = ({ actualColumnsRaw, actualColumnsCleaned, onValidationResult }) => {
  const normalizedExpected = expectedHeadersRaw.map(normalizeHeader);
  const normalizedActual = actualColumnsCleaned.map(col => normalizeHeader(col));

  const missing = normalizedExpected.filter(exp => !normalizedActual.includes(exp));
  const extra = normalizedActual.filter(act => !normalizedExpected.includes(act));

  const isValid = missing.length === 0;

  useEffect(() => {
    onValidationResult(isValid);
  }, [isValid, onValidationResult]);

  return (
    <div className="bg-[#014e56] p-6 rounded-lg shadow-lg mb-6">
      <h3 className="text-xl font-semibold mb-4 text-[#00f0cc]">Column Validation Result</h3>

      {isValid && extra.length === 0 ? (
        <p className="text-green-400 font-medium">✅ All required columns are present. No issues found.</p>
      ) : (
        <>
          {missing.length > 0 && (
            <div className="mb-4">
              <h4 className="text-red-400 font-semibold mb-2">❌ Missing Columns:</h4>
              <ul className="list-disc list-inside text-white">
                {missing.map((col, idx) => (
                  <li key={idx}>{expectedHeadersRaw[normalizedExpected.indexOf(col)]}</li>
                ))}
              </ul>
            </div>
          )}
          {extra.length > 0 && (
            <div>
              <h4 className="text-yellow-400 font-semibold mb-2">⚠️ Extra Columns (will be ignored):</h4>
              <ul className="list-disc list-inside text-white">
                {actualColumnsRaw.filter((_, i) => !normalizedExpected.includes(normalizeHeader(actualColumnsCleaned[i]))).map((col, idx) => (
                  <li key={idx}>{col}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ColumnValidator;
