// File: src/pages/MonthlyKPIInput.tsx

import React, { useState, useEffect } from "react";
import ProjectCarousel from "../ProjectCarousel";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { getAccessToken } from "../../auth/getToken";
import { msalInstance } from "../../auth/msalInstance";
import InputFormatted from "./InputFormatted";

const LISTS_CONFIG_KEY = "cmConfigLists";

interface MonthlyForm {
  Project: string;
  year: string;
  Month: string;
  Monthid: string;
  uniqueKey: string;
  DRXIdeasubmittedIdea: number;
  DRXIdeasubmittedIdeaGoal: number;
  productionminutes: number;
  downtimec: number;
  rateofdowntime: number;
  Targetdowntime: number;
  seuildinterventiondowntime: number;
  Budgetdepartment: number;
  Budgetdepartmentplanified: number;
}

interface IProject {
  id: string;
  displayName: string;
  logo?: string;
}

const parseDecimal = (val: string): number => {
  if (!val) return 0;
  return parseFloat(val.replace(",", "."));
};

const now = new Date();
const defaultYear = String(now.getFullYear());
const defaultMonth = String(now.getMonth() + 1).padStart(2, "0");

const defaultForm: MonthlyForm = {
  Project: "",
  year: defaultYear,
  Month: defaultMonth,
  Monthid: String(now.getMonth() + 1),
  uniqueKey: "",
  DRXIdeasubmittedIdea: 0,
  DRXIdeasubmittedIdeaGoal: 0,
  productionminutes: 0,
  downtimec: 0,
  rateofdowntime: 0,
  Targetdowntime: 0,
  seuildinterventiondowntime: 0,
  Budgetdepartment: 0,
  Budgetdepartmentplanified: 0,
};

const MonthlyKPIInput: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<IProject[]>([]);
  const [monthlyListId, setMonthlyListId] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [form, setForm] = useState<MonthlyForm>(defaultForm);

  const formatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
    useGrouping: false,
  });

  useEffect(() => {
    const raw = localStorage.getItem(LISTS_CONFIG_KEY);
    if (raw) {
      try {
        const config = JSON.parse(raw);
        setMonthlyListId(config.monthlyListId || null);
        setSiteId(config.siteId || null);
        if (config.projects && Array.isArray(config.projects)) {
          setProjects(config.projects);
          if (config.projects.length > 0) {
            setForm((prev) => ({ ...prev, Project: config.projects[0].id }));
          }
        }
      } catch (err) {
        console.error("Error loading config from localStorage:", err);
      }
    }
  }, []);

  useEffect(() => {
    if (form.Project && form.Month && form.year && siteId && monthlyListId) {
      const uniqueKey = `${form.Project}_${form.Monthid}_${form.year}`;
      setForm((prev) => ({ ...prev, uniqueKey }));
      checkOrCreateItem(uniqueKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.Project, form.Month, form.year, siteId, monthlyListId]);

  const checkOrCreateItem = async (uniqueKey: string) => {
    try {
      const token = await getAccessToken(msalInstance, ["https://graph.microsoft.com/Sites.Manage.All"]);
      const res = await axios.get(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${monthlyListId}/items?$expand=fields&$filter=fields/uniqueKey eq '${uniqueKey}'`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.value.length > 0) {
        setItemId(res.data.value[0].id);
      } else {
        const create = await axios.post(
          `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${monthlyListId}/items`,
          { fields: { Project: form.Project, year: form.year, Month: form.Month, Monthid: form.Monthid, uniqueKey } },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setItemId(create.data.id);
      }
    } catch (err) {
      console.error("Error checking or creating item:", err);
    }
  };

  const handleSaveSection = async (fields: Partial<MonthlyForm>) => {
    try {
      if (!siteId || !monthlyListId || !itemId) throw new Error("Missing config or item ID.");
      const token = await getAccessToken(msalInstance, ["https://graph.microsoft.com/Sites.Manage.All"]);

      const updates: any = { ...fields };

      // Auto-calculate rateofdowntime if needed
      if ("productionminutes" in updates || "downtimec" in updates) {
        const prod = updates.productionminutes ?? form.productionminutes;
        const down = updates.downtimec ?? form.downtimec;
        updates.rateofdowntime = prod > 0 ? down / prod : 0;
      }

      await axios.patch(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${monthlyListId}/items/${itemId}/fields`,
        updates,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMsg("✅ Section saved.");
      setForm(defaultForm);
      setItemId(null); // Force new item for next entry
    } catch (err: any) {
      console.error("Save failed:", err);
      setMsg("❌ Save failed: " + (err.response?.data?.error?.message || err.message));
    }
  };

  const handleNumberInput = (key: keyof MonthlyForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value.replace(",", "."));
    setForm((prev) => ({ ...prev, [key]: isNaN(val) ? 0 : val }));
  };

  const Section = ({ title, fields }: { title: string; fields: { label: string; key: keyof MonthlyForm }[] }) => (
    <fieldset className="border border-white/20 p-4 rounded-md space-y-4 mt-6">
      <legend className="text-lg font-semibold mb-4 text-white/80">{title}</legend>
      {fields.map(({ label, key }) => (
        <div key={key}>
          <label className="block font-semibold mb-1 text-white">{label}</label>
          <InputFormatted
            className="w-full p-2 border rounded text-black"
            value={form[key]}
            onChange={(e) => handleNumberInput(key)(e)}
            format={formatter.format}
          />
        </div>
      ))}
      <button
        onClick={() => handleSaveSection(
          Object.fromEntries(fields.map(({ key }) => [key, form[key]]))
        )}
        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded shadow"
      >
        Save {title}
      </button>
    </fieldset>
  );

  return (
    <div className="relative w-full min-h-screen bg-cover bg-center text-white">
      <div className="relative z-20 max-w-4xl mx-auto mt-6 p-6 bg-white/10 border border-white/20 backdrop-blur-md rounded-xl shadow-xl">
        {projects.length > 0 && (
          <ProjectCarousel
            projects={projects}
            selectedProject={form.Project}
            onProjectSelect={(projectId) => setForm((prev) => ({ ...prev, Project: projectId }))}
          />
        )}

        {msg && <div className="text-sm text-yellow-200 mt-4">{msg}</div>}

        <div className="flex space-x-4 mt-6">
          <div className="flex-1">
            <label className="block font-semibold mb-1 text-white">Year</label>
            <select
              value={form.year}
              onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))}
              className="w-full p-2 border rounded text-black"
            >
              {Array.from({ length: 5 }, (_, i) => 2024 + i).map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block font-semibold mb-1 text-white">Month</label>
            <select
              value={form.Month}
              onChange={(e) => setForm((prev) => ({
                ...prev,
                Month: e.target.value,
                Monthid: String(parseInt(e.target.value))
              }))}
              className="w-full p-2 border rounded text-black"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={String(i + 1).padStart(2, "0")}>
                  {new Date(0, i).toLocaleString("en-US", { month: "long" })}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Section
          title="Engineering DRX Ideas Tracking"
          fields={[
            { label: "DRX Idea submitted Idea", key: "DRXIdeasubmittedIdea" },
            { label: "DRX Idea submitted Idea Goal", key: "DRXIdeasubmittedIdeaGoal" },
          ]}
        />

        <Section
          title="Downtime"
          fields={[
            { label: "Downtime (minutes)", key: "downtimec" },
            { label: "Production Minutes", key: "productionminutes" },
            { label: "Target Downtime", key: "Targetdowntime" },
            { label: "Seuil d'intervention Downtime", key: "seuildinterventiondowntime" },
          ]}
        />

        <Section
          title="Budget"
          fields={[
            { label: "Actual Budget", key: "Budgetdepartment" },
            { label: "Planned Budget", key: "Budgetdepartmentplanified" },
          ]}
        />
      </div>
    </div>
  );
};

export default MonthlyKPIInput;
