// src/components/email/ResponseStatus.tsx
import React from "react";
import { QuestionState } from "../../pages/types";

export interface ResponseStatusProps {
  q: QuestionState;
  onCheck: () => void;
  onEdit: () => void;
}

const ResponseStatus: React.FC<ResponseStatusProps> = ({
  q, onCheck, onEdit
}) => (
  <div className="space-y-3 text-white">
    <div>Last Sent: {q.lastSent}</div>
    <div>Last Checked: {q.lastChecked}</div>
    <div>
      Response Received:{" "}
      <strong className={q.responseReceived ? "text-green-400" : "text-yellow-400"}>
        {q.responseReceived ? "Yes" : "No"}
      </strong>
    </div>
    <div className="flex gap-4">
      <button
        className="px-4 py-2 bg-sky-600 rounded"
        onClick={onCheck}
      >
        Check Response
      </button>
      <button
        className="px-4 py-2 bg-yellow-600 rounded"
        onClick={onEdit}
      >
        Edit
      </button>
    </div>
  </div>
);

export default ResponseStatus;
