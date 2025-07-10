import React, { useEffect, useState } from "react";
import ProjectCarousel from "../../components/ProjectCarousel";
import axios from "axios";
import { getAccessToken } from "../../auth/getToken";
import { msalInstance } from "../../auth/msalInstance";
import InputFormatted from "../../components/kpiEntry/InputFormatted";

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
  downtime: number;
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

interface FieldDef {
  label: string;
  key: keyof MonthlyForm;
}

interface SharePointItem {
  id: string;
  Title: string;
  [key: string]: any;
}

interface KPIInputWrapperProps {
  title: string;
  fields: FieldDef[];
  fixedProject?: string;
}

const formatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
  useGrouping: false,
});

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
  downtime: 0,
  rateofdowntime: 0,
  Targetdowntime: 0,
  seuildinterventiondowntime: 0,
  Budgetdepartment: 0,
  Budgetdepartmentplanified: 0,
};

const KPIInputWrapper: React.FC<KPIInputWrapperProps> = ({ title, fields, fixedProject }) => {
  const [projects, setProjects] = useState<IProject[]>([]);
  const [monthlyListId, setMonthlyListId] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setCachedItems] = useState<SharePointItem[]>([]);

  const [form, setForm] = useState<MonthlyForm>({
    ...defaultForm,
    Project: fixedProject || "",
  });

  // Update form.Project if fixedProject changes (or on mount)
  useEffect(() => {
    if (fixedProject) {
      setForm((prev) => ({ ...prev, Project: fixedProject }));
    }
  }, [fixedProject]);

  useEffect(() => {
    const raw = localStorage.getItem(LISTS_CONFIG_KEY);
    if (raw) {
      try {
        const config = JSON.parse(raw);
        setMonthlyListId(config.monthlyListId || null);
        setSiteId(config.siteId || null);
        if (config.projects && Array.isArray(config.projects)) {
          setProjects(config.projects);
        }
      } catch (err) {
        console.error("Error loading config from localStorage:", err);
      }
    }
  }, []);

  const fetchAndMatchItem = async (uniqueKey: string): Promise<SharePointItem | undefined> => {
    try {
      setLoading(true);
      const token = await getAccessToken(msalInstance, ["https://graph.microsoft.com/Sites.Manage.All"]);
      let items: SharePointItem[] = [];
      let nextLink: string | null = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${monthlyListId}/items?$expand=fields&$top=5000`;

      while (nextLink) {
        const res: { data: { value: any[]; "@odata.nextLink"?: string } } = await axios.get(nextLink, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const batch = res.data.value.map((item: any) => ({
          id: item.id,
          ...item.fields,
        }));

        items = [...items, ...batch];
        nextLink = res.data["@odata.nextLink"] || null;
      }

      setCachedItems(items);
      const match = items.find((i) => i.Title === uniqueKey);
      if (match) {
        setItemId(match.id);
        setForm((prev) => ({ ...prev, ...match }));
      }
      return match;
    } catch (err) {
      console.error("Error fetching items:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSection = async () => {
    try {
      if (!siteId || !monthlyListId) throw new Error("Missing site or list config.");
      const token = await getAccessToken(msalInstance, ["https://graph.microsoft.com/Sites.Manage.All"]);

      const projectValue = fixedProject || form.Project;
      const uniqueKey = `${projectValue}_${form.Monthid}_${form.year}`;
      setForm((prev) => ({ ...prev, uniqueKey, Project: projectValue }));

      let currentItemId = itemId;
      if (!currentItemId) {
        const match = await fetchAndMatchItem(uniqueKey);
        if (match) {
          currentItemId = match.id;
          setItemId(currentItemId);
        } else {
          const res = await axios.post(
            `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${monthlyListId}/items`,
            {
              fields: {
                Title: uniqueKey,
                Project: projectValue,
                year: form.year,
                Month: form.Month,
                Monthid: form.Monthid
              },
            },
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          );
          currentItemId = res.data.id;
          setItemId(currentItemId);
        }
      }

      const updates: Record<string, number> = {};
      fields.forEach(({ key }) => {
        const value = form[key];
        updates[key] = typeof value === "number" ? value : parseFloat(String(value));
      });

      if ("productionminutes" in updates || "downtime" in updates) {
        const prod = updates.productionminutes ?? form.productionminutes;
        const down = updates.downtime ?? form.downtime;
        updates.rateofdowntime = prod > 0 ? down / prod : 0;
      }

      await axios.patch(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${monthlyListId}/items/${currentItemId}/fields`,
        updates,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMsg("✅ Section saved.");
      // Full reset for next entry!
      setForm({
        ...defaultForm,
        Project: fixedProject || "",
      });
      setItemId(null);
    } catch (err: any) {
      console.error("Save failed:", err);
      setMsg("❌ Save failed: " + (err.response?.data?.error?.message || err.message));
    }
  };

  const handleNumberInput = (key: keyof MonthlyForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value.replace(",", "."));
    setForm((prev) => ({ ...prev, [key]: isNaN(val) ? 0 : val }));
  };

  return (
    <div className="relative w-full min-h-screen bg-cover bg-center text-white">
      <div className="relative z-20 max-w-4xl mx-auto mt-6 p-6 bg-white/10 border border-white/20 backdrop-blur-md rounded-xl shadow-xl">
        <h2 className="text-2xl font-semibold mb-4 text-white/80">{title}</h2>

        {fixedProject ? (
          <div className="mb-4">
            <label className="block font-semibold mb-1 text-white">Project</label>
            <div className="p-2 border rounded text-black bg-gray-100">{fixedProject}</div>
          </div>
        ) : (
          projects.length > 0 && (
            <ProjectCarousel
              projects={projects}
              selectedProject={form.Project}
              onProjectSelect={(projectId) => setForm((prev) => ({ ...prev, Project: projectId }))}
            />
          )
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

        {loading ? (
          <div className="text-yellow-300 text-sm mt-4">⏳ Loading data...</div>
        ) : msg ? (
          <div className="text-sm text-yellow-200 mt-4">{msg}</div>
        ) : null}

        <fieldset className="border border-white/20 p-4 rounded-md space-y-4 mt-6">
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
            onClick={handleSaveSection}
            className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded shadow"
          >
            Save {title}
          </button>
        </fieldset>
      </div>
    </div>
  );
};

export default KPIInputWrapper;
