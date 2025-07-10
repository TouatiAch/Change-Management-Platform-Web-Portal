// File: src/pages/shared/BudgetInputWrapper.tsx

import React, { useEffect, useState } from "react";
import axios from "axios";
import { getAccessToken } from "../../auth/getToken";
import { msalInstance } from "../../auth/msalInstance";
import ProjectCarousel from "../ProjectCarousel";
import InputFormatted from "./InputFormatted";


const LISTS_CONFIG_KEY = "cmConfigLists";

interface BudgetForm {
  Project: string;
  year: string;
  Month: string;
  Category: string;
  Budgetdepartment: number;
  Budgetdepartmentplanified: number;
}

interface IProject {
  id: string;
  displayName: string;
  logo?: string;
}

const formatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false,
});

const BudgetInputWrapper: React.FC = () => {
  const [projects, setProjects] = useState<IProject[]>([]);
  const [budgetsListId, setBudgetsListId] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const now = new Date();
  const defaultYear = String(now.getFullYear());
  const defaultMonth = String(now.getMonth() + 1).padStart(2, "0");

  const defaultForm: BudgetForm = {
    Project: "",
    year: defaultYear,
    Month: defaultMonth,
    Category: "",
    Budgetdepartment: 0,
    Budgetdepartmentplanified: 0,
  };

  const [form, setForm] = useState<BudgetForm>(defaultForm);

  useEffect(() => {
    const raw = localStorage.getItem(LISTS_CONFIG_KEY);
    if (raw) {
      try {
        const config = JSON.parse(raw);
        setBudgetsListId(config.budgetsListId || null);
        setSiteId(config.siteId || null);
        if (config.projects && Array.isArray(config.projects)) {
          setProjects(config.projects);
        }
      } catch (err) {
        console.error("Error loading config from localStorage:", err);
      }
    }
  }, []);

  // Fetch existing item logic could go here if you want to allow editing

  const handleSave = async () => {
    try {
      if (!siteId || !budgetsListId) throw new Error("Missing site or list config.");
      setLoading(true);
      const token = await getAccessToken(msalInstance, ["https://graph.microsoft.com/Sites.Manage.All"]);

      // UniqueKey for upsert logic (optional)
      const uniqueKey = `${form.Project}_${form.Month}_${form.year}_${form.Category}`;

      // Optional: Upsert existing item if you want "edit" not just "add new"
      // For simplicity, this just adds new entries

      await axios.post(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${budgetsListId}/items`,
        {
          fields: {
            Project: form.Project,
            year: form.year,
            Month: form.Month,
            Category: form.Category,
            Budgetdepartment: form.Budgetdepartment,
            Budgetdepartmentplanified: form.Budgetdepartmentplanified,
            Title: uniqueKey, // optional for SharePoint
          },
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setMsg("✅ Budget KPI entry saved.");
      // FULL form reset (including Project, year, Month, Category)
      setForm(defaultForm);
    } catch (err: any) {
      setMsg("❌ Save failed: " + (err.response?.data?.error?.message || err.message));
      console.error("Save failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-cover bg-center text-white">
      <div className="relative z-20 max-w-4xl mx-auto mt-6 p-6 bg-white/10 border border-white/20 backdrop-blur-md rounded-xl shadow-xl">
        <h2 className="text-2xl font-semibold mb-4 text-white/80"> Budget </h2>
        {projects.length > 0 && (
          <ProjectCarousel
            projects={projects}
            selectedProject={form.Project}
            onProjectSelect={(projectId) => setForm((prev) => ({ ...prev, Project: projectId }))}
          />
        )}
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
                Month: e.target.value
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

        <div className="mt-6">
          <label className="block font-semibold mb-1 text-white">Budget Category</label>
          <input
            className="w-full p-2 border rounded text-black"
            placeholder="e.g. IT, Bills, etc."
            value={form.Category}
            onChange={e => setForm(prev => ({ ...prev, Category: e.target.value }))}
          />
        </div>

        <div className="mt-6">
          <label className="block font-semibold mb-1 text-white">Department Budget</label>
          <InputFormatted
            className="w-full p-2 border rounded text-black"
            value={form.Budgetdepartment}
            onChange={e => setForm(prev => ({
              ...prev,
              Budgetdepartment: parseFloat(e.target.value.replace(",", ".")) || 0
            }))}
            format={formatter.format}
          />
        </div>

        <div className="mt-6">
          <label className="block font-semibold mb-1 text-white">Planified Budget</label>
          <InputFormatted
            className="w-full p-2 border rounded text-black"
            value={form.Budgetdepartmentplanified}
            onChange={e => setForm(prev => ({
              ...prev,
              Budgetdepartmentplanified: parseFloat(e.target.value.replace(",", ".")) || 0
            }))}
            format={formatter.format}
          />
        </div>

        {loading ? (
          <div className="text-yellow-300 text-sm mt-4">⏳ Saving data...</div>
        ) : msg ? (
          <div className="text-sm text-yellow-200 mt-4">{msg}</div>
        ) : null}

        <button
          onClick={handleSave}
          className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded shadow"
          disabled={loading}
        >
          Save Budget KPI
        </button>
      </div>
    </div>
  );
};

export default BudgetInputWrapper;
