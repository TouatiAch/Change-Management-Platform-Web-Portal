// src/components/email/QuestionRow.tsx
import React from "react";
import { QuestionState } from "../../pages/types";

interface Props {
  q: QuestionState;
  onSend: () => void;
  onEdit: () => void;
}

const QuestionRow: React.FC<Props> = ({ q, onSend, onEdit }) => {
  const isSent = Boolean(q.lastSent);
  return (
    <div className="grid grid-cols-2 … text-white">
      <div><strong>{q.description}</strong></div>
      <div className="flex justify-end gap-2">
        <button
          className={`px-3 py-1 rounded ${
            isSent ? "bg-sky-600" : "bg-blue-600"
          }`}
          onClick={onSend}
        >
          {isSent ? "Check Response" : "Send Email"}
        </button>
        <button
          className="px-3 py-1 bg-yellow-600 rounded"
          onClick={onEdit}
        >Edit</button>
      </div>
    </div>
  );
};

export default QuestionRow;
