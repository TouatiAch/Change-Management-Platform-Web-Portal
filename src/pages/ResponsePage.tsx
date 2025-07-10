// src/pages/ResponsePage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopMenu from "../components/TopMenu";
import ResponseView from "../components/email/ResponseView";
import { graphService } from "../services/EmailgraphService";
import { QuestionState } from "./types";
import harnessBg from "../assets/images/harness-bg.png";

export default function ResponsePage() {
  const navigate = useNavigate();
  const params = useParams<{
    projectKey: string;
    phase:      string;
    itemId:     string;
    questionId: string;
  }>();
  const { projectKey, phase, itemId, questionId } = params;

  const [q, setQ] = useState<QuestionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!projectKey || !itemId || !questionId) return;
    (async () => {
      setLoading(true);
      try {
        const question = await graphService.getQuestion(
          projectKey, phase!, itemId, questionId
        );
        setQ(question);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectKey, phase, itemId, questionId]);

  const doCheck = async () => {
    if (!q) return;
    setChecking(true);
    try {
      const fixedSubject = `${q.questionId} ${q.changeNumber} - `;
      const updated = await graphService.pollInboxFast(q, fixedSubject);
      setQ(updated);
    } finally {
      setChecking(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-white">Loading…</div>;
  if (!q)      return <div className="h-screen flex items-center justify-center text-red-400">Question not found</div>;

  return (
    <div
      className="relative w-full min-h-screen bg-cover bg-center text-white"
      style={{ backgroundImage: `url(${harnessBg})` }}
    >
      <TopMenu />
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-2xl shadow-md"
      >← Back</button>

      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-8 space-y-6">
          <h1 className="text-3xl font-bold">Review Response</h1>
          <p>Question: <strong>{q.questionId}</strong></p>

          {q.responseReceived ? (
            <ResponseView
              q={{
                ...q,
                replySubject: q.replySubject,
                replyBody: q.replyBody,
                replyReceivedDate: q.replyReceivedDate,
                replyFrom: q.responsibleEmail
              }}
            />
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <p>No response detected yet.</p>
              <button
                onClick={doCheck}
                disabled={checking}
                className="px-6 py-3 bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {checking ? "Checking…" : "Check for Response"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
