// src/components/LogsViewer.tsx
import React from "react";

interface Props {
  logs: string[];
}

const LogsViewer: React.FC<Props> = ({ logs }) => {
  return (
    <div className="logs-viewer">
      <h3>Logs</h3>
      <div className="log-box" style={{
        background: "#f5f5f5",
        padding: "1rem",
        border: "1px solid #ccc",
        maxHeight: "250px",
        overflowY: "auto",
        fontFamily: "monospace"
      }}>
        {logs.length === 0 ? (
          <div>No logs yet.</div>
        ) : (
          logs.map((entry, idx) => <div key={idx}>{entry}</div>)
        )}
      </div>
    </div>
  );
};

export default LogsViewer;
