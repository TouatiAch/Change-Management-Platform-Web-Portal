// src/pages/SendEmailPage.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import TopMenu from "../components/TopMenu";
import EmailSettings from "../components/email/EmailSettings";
import harnessBg from "../assets/images/harness-bg.png";
import { QuestionState } from "./types";
import { graphService } from "../services/EmailgraphService";

export default function SendEmailPage() {
  const navigate = useNavigate();
  const { projectKey, phase, itemId, questionId } = useParams<{
    projectKey: string;
    phase:      string;
    itemId:     string;
    questionId: string;
  }>();

  const [q, setQ] = useState<QuestionState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectKey || !phase || !itemId || !questionId) return;
    setLoading(true);
    graphService
      .getQuestion(projectKey, phase, itemId, questionId)
      .then(setQ)
      .catch(err => {
        console.error(err);
        toast.error("Failed to load question");
      })
      .finally(() => setLoading(false));
  }, [projectKey, phase, itemId, questionId]);

  if (loading) return <div className="p-8 text-white">Loading…</div>;
  if (!q)      return <div className="p-8 text-red-400">Question not found</div>;

  // 1) fixed prefixes
  const fixedSubject = `${q.questionId} ${q.changeNumber} - `;
  const fixedBody    = `${q.action}\n\n`;

  // 2) strip them off of the stored values to get only the custom suffix
  const storedSubj = q.emailsubject || "";
  const initialCustomSubject = storedSubj.startsWith(fixedSubject)
    ? storedSubj.slice(fixedSubject.length)
    : storedSubj;

  const storedBody = q.emailbody || "";
  const initialCustomBody = storedBody.startsWith(fixedBody)
    ? storedBody.slice(fixedBody.length)
    : storedBody;

  return (
    <div
      className="relative w-full min-h-screen bg-cover bg-center text-white"
      style={{ backgroundImage: `url(${harnessBg})` }}
    >
      <ToastContainer />
      <TopMenu />

      <button
        onClick={() => navigate(`/send-email/${projectKey}/${phase}/${itemId}`)}
        className="absolute top-4 left-4 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-2xl shadow-md"
      >
        ← Back to Questions
      </button>

      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-2">Send Email</h1>
          <h2 className="text-xl text-white/80 mb-6">
            Question: {q.questionId}
          </h2>

          <EmailSettings
            q={q}
            fixedSubject={fixedSubject}
            fixedBody={fixedBody}
            initialCustomSubject={initialCustomSubject}
            initialCustomBody={initialCustomBody}
            onSaveOrSend={async (updated, action) => {
              try {
                if (action === "save") {
                  // Persist settings only
                  await graphService.saveQuestion(updated);
                  setQ(updated);
                  toast.success("Settings saved");
                } else {
                  // Build full email payload
                  const toSend: QuestionState = {
                    ...updated,
                    emailsubject: fixedSubject + updated.emailsubject!,
                    emailbody:    fixedBody   + updated.emailbody!
                  };
                  // 1) Send the email
                  await graphService.sendMail(toSend);
                  // 2) Patch SharePoint item with lastSent & reset responseReceived
                  const nowIso = new Date().toISOString();
                  const patched: QuestionState = {
                    ...toSend,
                    lastSent:         nowIso,
                    responseReceived: false
                  };
                  await graphService.saveQuestion(patched);
                  setQ(patched);
                  toast.success("Email sent");
                  // 3) Navigate back to the explicit questions list URL
                  navigate(`/send-email/${projectKey}/${phase}/${itemId}`);
                }
              } catch (err: any) {
                console.error(err);
                toast.error(`Operation failed: ${err.message}`);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
