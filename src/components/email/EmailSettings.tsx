// src/components/email/EmailSettings.tsx
import React, { useState, useEffect } from "react";
import { IntervalUnit, QuestionState } from "../../pages/types";
import { getGraphToken } from "../../hooks/useGraphAuth";

export interface EmailSettingsProps {
  q: QuestionState;
  fixedSubject: string;
  fixedBody: string;
  initialCustomSubject: string;
  initialCustomBody:   string;
  onSaveOrSend: (
    updated: QuestionState,
    action: "save" | "send"
  ) => Promise<any>;
}

const INTERVAL_UNITS: IntervalUnit[] = ["Minutes", "Hours", "Days"];

interface Person {
  id: string;
  displayName: string;
  scoredEmailAddresses: { address: string }[];
}

const EmailSettings: React.FC<EmailSettingsProps> = ({
  q,
  fixedSubject,
  fixedBody,
  initialCustomSubject,
  initialCustomBody,
  onSaveOrSend
}) => {
  // form state
  const [people,    setPeople]    = useState<Person[]>([]);
  const [respEmail, setRespEmail] = useState(q.responsibleEmail);
  const [ccList,    setCcList]    = useState<string[]>([]);
  const [value,     setValue]     = useState(q.sendIntervalValue);
  const [unit,      setUnit]      = useState<IntervalUnit>(q.sendIntervalUnit);

  // custom bits
  const [subjectPart, setSubjectPart] = useState(initialCustomSubject);
  const [bodyPart,    setBodyPart]    = useState(initialCustomBody);

  // fetch “people I’ve emailed”
  useEffect(() => {
    (async () => {
      const token = await getGraphToken();
      if (!token) return;
      const res = await fetch(
        "https://graph.microsoft.com/v1.0/me/people?$select=displayName,scoredEmailAddresses,id",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      console.debug("🛠️ /me/people →", json);
      if (Array.isArray(json.value)) {
        setPeople(
          json.value.filter((p: Person) =>
            Array.isArray(p.scoredEmailAddresses) && p.scoredEmailAddresses.length > 0
          )
        );
      }
    })();
  }, []);

  // build updated Q
  const updatedQ: QuestionState = {
    ...q,
    responsibleEmail:   respEmail,
    cc:                 ccList.join(","),
    sendIntervalValue:  value,
    sendIntervalUnit:   unit,
    emailsubject:       subjectPart,
    emailbody:          bodyPart,
  };

  return (
    <div className="space-y-6 text-white">
      {/* Responsible */}
      <div>
        <label className="block font-semibold mb-1">Responsible</label>
        {people.length > 0 ? (
          <select
            className="w-full px-4 py-2 bg-white/80 text-black rounded-xl shadow-sm focus:ring-2 focus:ring-blue-400"
            value={respEmail}
            onChange={e => setRespEmail(e.target.value)}
          >
            <option value="">— Select a person —</option>
            {people.map(p => {
              const mail = p.scoredEmailAddresses[0].address;
              return (
                <option key={p.id} value={mail}>
                  {p.displayName} &lt;{mail}&gt;
                </option>
              );
            })}
          </select>
        ) : (
          <input
            type="email"
            className="w-full px-4 py-2 bg-white/80 text-black rounded-xl shadow-sm focus:ring-2 focus:ring-blue-400"
            placeholder="Enter responsible's email…"
            value={respEmail}
            onChange={e => setRespEmail(e.target.value)}
          />
        )}
      </div>

      {/* CC */}
      <div>
        <label className="block font-semibold mb-1">CC (optional)</label>
        {people.length > 0 ? (
          <select
            multiple
            size={5}
            className="w-full px-4 py-2 bg-white/80 text-black rounded-xl shadow-sm focus:ring-2 focus:ring-blue-400"
            value={ccList}
            onChange={e =>
              setCcList(Array.from(e.target.selectedOptions, o => o.value))
            }
          >
            {people.map(p => {
              const mail = p.scoredEmailAddresses[0].address;
              return (
                <option key={p.id} value={mail}>
                  {p.displayName} &lt;{mail}&gt;
                </option>
              );
            })}
          </select>
        ) : (
          <input
            type="text"
            className="w-full px-4 py-2 bg-white/80 text-black rounded-xl shadow-sm focus:ring-2 focus:ring-blue-400"
            placeholder="Comma‑separated CC emails…"
            value={ccList.join(",")}
            onChange={e => setCcList(e.target.value.split(",").map(s => s.trim()))}
          />
        )}
      </div>

      {/* Interval */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block font-semibold mb-1">Send Interval Value</label>
          <input
            type="number"
            min={1}
            className="w-full px-4 py-2 bg-white/80 text-black rounded-xl shadow-sm focus:ring-2 focus:ring-blue-400"
            value={value}
            onChange={e => setValue(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block font-semibold mb-1">Send Interval Unit</label>
          <select
            className="w-full px-4 py-2 bg-white/80 text-black rounded-xl shadow-sm focus:ring-2 focus:ring-blue-400"
            value={unit}
            onChange={e => setUnit(e.target.value as IntervalUnit)}
          >
            {INTERVAL_UNITS.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Subject */}
      <div>
        <label className="block font-semibold mb-1">Subject</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            readOnly
            disabled
            className="w-full px-4 py-2 bg-white/60 text-black rounded-xl shadow-sm"
            value={fixedSubject}
          />
          <input
            type="text"
            className="w-full px-4 py-2 bg-white/80 text-black rounded-xl shadow-sm focus:ring-2 focus:ring-blue-400"
            placeholder="Add custom subject text…"
            value={subjectPart}
            onChange={e => setSubjectPart(e.target.value)}
          />
        </div>
      </div>

      {/* Body */}
      <div>
        <label className="block font-semibold mb-1">Body</label>
        <textarea
          readOnly
          disabled
          className="w-full px-4 py-2 bg-white/60 text-black rounded-xl shadow-sm mb-2"
          rows={3}
          value={fixedBody}
        />
        <textarea
          className="w-full px-4 py-2 bg-white/80 text-black rounded-xl shadow-sm focus:ring-2 focus:ring-blue-400"
          rows={5}
          placeholder="Add custom message…"
          value={bodyPart}
          onChange={e => setBodyPart(e.target.value)}
        />
      </div>

      {/* Save / Send */}
      <div className="flex gap-4">
        <button
          className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-xl shadow-md transition"
          onClick={() => onSaveOrSend(updatedQ, "save")}
        >
          Save
        </button>
        <button
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition"
          onClick={() => onSaveOrSend(updatedQ, "send")}
        >
          Send Email
        </button>
      </div>
    </div>
  );
};

export default EmailSettings;
