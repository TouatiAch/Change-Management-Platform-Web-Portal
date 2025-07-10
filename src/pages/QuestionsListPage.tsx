// src/pages/QuestionsListPage.tsx

import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import TopMenu from "../components/TopMenu";
import { useQuestions } from "../hooks/useQuestions";
import { getGraphToken } from "../hooks/useGraphAuth";
import harnessBg from "../assets/images/harness-bg.png";
import { QuestionState } from "./types";
import { graphService } from "../services/EmailgraphService";

interface LastEmail {
  id: string;
  from: string;
  subject: string;
  received: string;
}

const QuestionsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { projectKey, phase, itemId } = useParams<{
    projectKey: string;
    phase:      string;
    itemId:     string;
  }>();

  // Redirect home if params missing
  useEffect(() => {
    if (!projectKey || !phase || !itemId) navigate("/");
  }, [projectKey, phase, itemId, navigate]);

  const { questions, loading, error } = useQuestions(projectKey!, itemId!);
  const [qs, setQs] = useState<QuestionState[]>([]);
  const [checkingMap, setCheckingMap] = useState<Record<string, boolean>>({});
  const [lastEmails, setLastEmails] = useState<LastEmail[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);

  useEffect(() => {
    setQs(questions);
  }, [questions]);

  const goBack = () => navigate(`/details/${projectKey}/${phase}/${itemId}`);
  const onSend  = (q: QuestionState) =>
    navigate(`/send-email/${projectKey}/${phase}/${itemId}/${q.id}`);

  const onCheck = async (q: QuestionState) => {
    const fixedSubject = `${q.questionId} ${q.changeNumber} - `;
    setCheckingMap(m => ({ ...m, [q.id]: true }));
    try {
      const updated = await graphService.pollInboxFast(q, fixedSubject);
      setQs(curr => curr.map(x => x.id === q.id ? updated : x));
      toast[updated.responseReceived ? "success" : "info"](
        updated.responseReceived
          ? "Reply detected!"
          : "No reply found yet"
      );
    } catch (err: any) {
      console.error(err);
      toast.error("Error checking inbox");
    } finally {
      setCheckingMap(m => ({ ...m, [q.id]: false }));
    }
  };

  const showLast3Emails = async () => {
    setLoadingEmails(true);
    try {
      const token = await getGraphToken();
      if (!token) throw new Error("No Graph token");
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(
        "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages" +
        "?$top=3&$orderby=receivedDateTime desc&$select=subject,receivedDateTime,from",
        { headers }
      );
      const emails: LastEmail[] = res.data.value.map((m: any) => ({
        id:       m.id,
        from:     m.from?.emailAddress?.address || "Unknown",
        subject:  m.subject,
        received: m.receivedDateTime
      }));
      setLastEmails(emails);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load last emails");
    } finally {
      setLoadingEmails(false);
    }
  };

  return (
  <div
    className="relative w-full min-h-screen bg-cover bg-center text-white"
    style={{ backgroundImage: `url(${harnessBg})` }}
  >
    <ToastContainer />
    <TopMenu />

    <button
      onClick={goBack}
      className="absolute top-4 left-4 z-20 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-2xl shadow-md"
    >
      ← Back
    </button>

    <div className="max-w-6xl mx-auto py-10 px-4 space-y-6">
      {/* Header & Show Emails */}
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl shadow-xl p-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold">Questions for Change</h1>
        <button
          onClick={showLast3Emails}
          disabled={loadingEmails}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded transition"
        >
          {loadingEmails ? "Loading…" : "Show Last 3 Emails"}
        </button>
      </div>

      {/* Last Emails Panel */}
      {lastEmails.length > 0 && (
        <div className="bg-white/20 backdrop-blur-md rounded-xl shadow-inner p-6 space-y-2">
          <h2 className="font-semibold">Most Recent Emails</h2>
          {lastEmails.map(e => (
            <div key={e.id} className="text-sm">
              <div><strong>From:</strong> {e.from}</div>
              <div><strong>Subject:</strong> {e.subject}</div>
              <div><strong>Received:</strong> {new Date(e.received).toLocaleString()}</div>
              <hr className="border-t border-white/20 my-2"/>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div>Loading…</div>
      ) : error ? (
        <div className="text-red-400">{error}</div>
      ) : (
        <div className="space-y-4">
          {qs.map(q => (
            <div
              key={q.id}
              className="bg-white/20 p-4 rounded-xl shadow-md"
            >
              <div className="flex justify-between items-center">
                <div className="font-semibold text-lg truncate">
                  {q.description}
                </div>
                <button
                  onClick={() => onSend(q)}
                  className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 transition"
                >
                  Send
                </button>
              </div>

              {q.lastSent && (
                <div className="mt-3 grid grid-cols-3 gap-4 text-sm text-white/80">
                  <div>
                    <strong>Last Sent:</strong>{" "}
                    {new Date(q.lastSent).toLocaleString()}
                  </div>
                  <div>
                    <strong>Response:</strong>{" "}
                    <span className={q.responseReceived ? "text-green-400" : "text-yellow-400"}>
                      {q.responseReceived ? "Yes" : "No"}
                    </span>
                  </div>
                  <div>
                    {q.responseReceived ? (
                      <button
                        onClick={() =>
                          navigate(`/response/${projectKey}/${phase}/${itemId}/${q.id}`)
                        }
                        className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                      >
                        View Response
                      </button>
                    ) : (
                      <button
                        onClick={() => onCheck(q)}
                        disabled={checkingMap[q.id]}
                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition"
                      >
                        {checkingMap[q.id] ? "Checking…" : "Check Response"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

};

export default QuestionsListPage;
