// src/components/email/ResponseView.tsx
import React from "react";
import { QuestionState } from "../../pages/types";

interface Props {
  q: QuestionState & {
    replySubject?: string;
    replyBody?: string;
    replyFrom?: string;
    replyReceivedDate?: string;
  };
}

const ResponseView: React.FC<Props> = ({ q }) => (
  <div className="space-y-4">
    <h3 className="text-lg font-semibold">Reply Received</h3>
    <p><strong>From:</strong> {q.replyFrom}</p>
    <p><strong>Subject:</strong> {q.replySubject}</p>
    <div className="bg-white/20 p-4 rounded">
      <div
        className="prose prose-invert"
        dangerouslySetInnerHTML={{ __html: q.replyBody || "" }}
      />
    </div>
    <p className="text-sm text-white/60">
      Received at: {new Date(q.replyReceivedDate!).toLocaleString()}
    </p>
  </div>
);

export default ResponseView;
