// src/components/email/QuestionsList.tsx
import React from "react";
import QuestionRow from "./QuestionRow";
import { QuestionState } from "../../pages/types";

interface Props {
  questions: QuestionState[];
  loading: boolean;
  error: string | null;
  onSend: (q: QuestionState) => void;
  onEdit: (q: QuestionState) => void;
}

const QuestionsList: React.FC<Props> = ({ questions, loading, error, onSend, onEdit }) => {
  if (loading) return <div>Loading…</div>;
  if (error)   return <div className="text-red-500">{error}</div>;

  return (
    <div>
      <div className="grid grid-cols-2 … text-white">
        <div>Question</div>
        <div>Action</div>
      </div>
      {questions.map(q => (
        <QuestionRow
          key={q.id}
          q={q}
          onSend={() => onSend(q)}
          onEdit={() => onEdit(q)}
        />
      ))}
    </div>
  );
};

export default QuestionsList;
