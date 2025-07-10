// src/components/email/EmailSettings.tsx
import React, { useState } from "react";
import { IntervalUnit, QuestionState } from "../../pages/types";

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

const EmailSettings: React.FC<EmailSettingsProps> = ({
  q,
  fixedSubject,
  fixedBody,
  initialCustomSubject,
  initialCustomBody,
  onSaveOrSend
}) => {
  // === form state ===
  const [respEmail, setRespEmail]     = useState(q.responsibleEmail);
  const [cc, setCc]                   = useState(q.cc || "");
  const [value, setValue]             = useState(q.sendIntervalValue);
  const [unit, setUnit]               = useState<IntervalUnit>(q.sendIntervalUnit);

  // ** only the custom suffix bits here **
  const [subjectPart, setSubjectPart] = useState(initialCustomSubject);
  const [bodyPart, setBodyPart]       = useState(initialCustomBody);

  // whenever we call back, we stash these suffixes onto our QuestionState
  const updatedQ: QuestionState = {
    ...q,
    responsibleEmail:   respEmail,
    cc,
    sendIntervalValue:  value,
    sendIntervalUnit:   unit,
    emailsubject:       subjectPart,
    emailbody:          bodyPart,
  };

  return (
    <div className="space-y-6 text-white">
      {/* Responsible & CC */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block font-semibold mb-1">Responsible Email</label>
          <input
            type="email"
            className="w-full px-4 py-2 bg-white/80 text-black rounded-xl shadow-sm focus:ring-2 focus:ring-blue-400"
            value={respEmail}
            onChange={e => setRespEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="block font-semibold mb-1">CC (optional)</label>
          <input
            className="w-full px-4 py-2 bg-white/80 text-black rounded-xl shadow-sm focus:ring-2 focus:ring-blue-400"
            value={cc}
            onChange={e => setCc(e.target.value)}
          />
        </div>
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
          {/* fixed prefix (readonly) */}
          <input
            type="text"
            readOnly
            disabled
            className="w-full px-4 py-2 bg-white/60 text-black rounded-xl shadow-sm"
            value={fixedSubject}
          />
          {/* custom suffix */}
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
        {/* fixed intro */}
        <textarea
          readOnly
          disabled
          className="w-full px-4 py-2 bg-white/60 text-black rounded-xl shadow-sm mb-2"
          rows={3}
          value={fixedBody}
        />
        {/* custom body */}
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
