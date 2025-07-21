// src/components/email/MultiEmailSelect.tsx
import React from "react";
import Select from "react-select";
import type { Address } from "../../utils/convertRecipients";

interface Props {
  label:       string;
  placeholder: string;
  suggestions: Address[];           // full list from Graph / history
  value:       string[];            // currently selected e‑mails
  onChange:   (v: string[]) => void;
}

export const MultiEmailSelect: React.FC<Props> = ({
  label, placeholder, suggestions, value, onChange,
}) => {
  const options = suggestions.map((p) => ({
    label: `${p.name} <${p.email}>`,
    value: p.email,
  }));

  return (
    <div className="mb-6">
      <label className="block mb-1 text-sm font-semibold">{label}</label>

      <Select
        classNamePrefix="react-select"
        options={options}
        placeholder={placeholder}
        isMulti
        closeMenuOnSelect={false}
        value={options.filter((o) => value.includes(o.value))}
        onChange={(sel) => onChange(sel.map((o) => o.value))}
        menuPlacement="auto"
      />
    </div>
  );
};
