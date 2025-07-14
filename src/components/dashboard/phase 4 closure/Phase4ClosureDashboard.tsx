import React, { useState, useEffect } from "react";
import axios from "axios";
import ProjectCarousel from "../../ProjectCarousel";

export interface Project {
  id: string;
  displayName: string;
}
export interface ChangeItem {
  ID: string;
  Project?: string;
  Carline?: string;
  Processnumber?: string;
  StartdatePhase4?: string;
  EnddatePAVPhase4?: string;
  EndDateLogisticPhase4?: string;
  EndDateQSPhase4?: string;
  EndDatePSCRPhase4?: string;
  processyear?: string;
  processmonth?: string;
  processid?: string;
}
interface Phase4ClosureDashboardProps {
  projects: Project[];
  changeItems: ChangeItem[];
  phase4TargetsListId?: string;
  siteId: string;
  getToken: () => Promise<string>;
}
interface SharePointTargetItem {
  id: string;
  Project: string;
  Department: string;
  Target: number;
}

const DEPARTMENTS = [
  { key: "PAV", label: "PaV" },
  { key: "LOGISTIC", label: "Logistic" },
  { key: "QS", label: "QS" },
  { key: "PSCR", label: "PSCR" },
];

const Phase4ClosureDashboard: React.FC<Phase4ClosureDashboardProps> = ({
  projects,
  phase4TargetsListId,
  siteId,
  getToken,
}) => {
  const [selectedProject, setSelectedProject] = useState<string>(projects[0]?.id || "");
  const [targets, setTargets] = useState<{ [projectId: string]: { [dep: string]: number } }>({});
  const [spTargetItems, setSpTargetItems] = useState<SharePointTargetItem[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);

  useEffect(() => {
    const fetchTargets = async () => {
      if (!phase4TargetsListId || !siteId) return;
      setLoadingTargets(true);
      try {
        const token = await getToken();
        const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${phase4TargetsListId}/items?$expand=fields&$top=999`;
        const resp = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const items: SharePointTargetItem[] = resp.data.value
          .map((item: any) => ({
            id: item.id,
            Project: item.fields.Project,
            Department: item.fields.Department,
            Target: Number(item.fields.Target),
          }))
          .filter((it: SharePointTargetItem) => it.Project && it.Department);

        setSpTargetItems(items);

        // Convert to local state structure
        const newTargets: { [projectId: string]: { [dep: string]: number } } = {};
        projects.forEach(proj => {
          const projTargets: { [dep: string]: number } = {};
          DEPARTMENTS.forEach(dep => {
            const tItem = items.find(
              (it) =>
                (it.Project === proj.displayName || it.Project === proj.id) &&
                it.Department === dep.key
            );
            if (tItem) projTargets[dep.key] = tItem.Target;
          });
          if (Object.keys(projTargets).length) {
            newTargets[proj.id] = projTargets;
          }
        });
        setTargets(newTargets);
      } catch (e) {
        console.error("Failed to fetch targets from SP:", e);
      }
      setLoadingTargets(false);
    };
    fetchTargets();
    // eslint-disable-next-line
  }, [phase4TargetsListId, siteId, projects, getToken]);

  // --- Handlers ---
  const handleTargetChange = async (dep: string, value: string | number) => {
    const targetVal = Number(value) || 0;
    const projectObj = projects.find((p) => p.id === selectedProject);
    if (!projectObj) return;

    // Update local state
    setTargets((prev) => ({
      ...prev,
      [selectedProject]: {
        ...prev[selectedProject],
        [dep]: targetVal,
      },
    }));

    // Update (or create) target in SharePoint
    try {
      const token = await getToken();
      const existing = spTargetItems.find(
        (it) =>
          (it.Project === projectObj.displayName || it.Project === projectObj.id) &&
          it.Department === dep
      );

      if (existing) {
        // Update
        const patchUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${phase4TargetsListId}/items/${existing.id}/fields`;
        await axios.patch(
          patchUrl,
          { Target: targetVal },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSpTargetItems((prev) =>
          prev.map((item) =>
            item.id === existing.id ? { ...item, Target: targetVal } : item
          )
        );
      } else {
        // Create
        const postUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${phase4TargetsListId}/items`;
        await axios.post(
          postUrl,
          {
            fields: {
              Project: projectObj.displayName,
              Department: dep,
              Target: targetVal,
            },
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setTimeout(() => {
          (async () => {
            const token2 = await getToken();
            const url2 = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${phase4TargetsListId}/items?expand=fields&$top=999`;
            const resp2 = await axios.get(url2, {
              headers: { Authorization: `Bearer ${token2}` },
            });
            const items2: SharePointTargetItem[] = resp2.data.value
              .map((item: any) => ({
                id: item.id,
                Project: item.fields.Project,
                Department: item.fields.Department,
                Target: Number(item.fields.Target),
              }))
              .filter((it: SharePointTargetItem) => it.Project && it.Department);
            setSpTargetItems(items2);
          })();
        }, 1000);
      }
    } catch (err) {
      alert("Failed to update target in SharePoint. Check your permissions.");
      console.error(err);
    }
  };

  return (
    <div className="relative z-20 max-w-2xl mx-auto p-4 bg-white/10 border border-white/20 backdrop-blur-md rounded-xl shadow-xl">
  {/* Project Carousel */}
  <div className="mb-6" style={{ minWidth: 150 }}>
    <ProjectCarousel
      projects={projects}
      selectedProject={selectedProject}
      onProjectSelect={setSelectedProject}
    />
  </div>
  {/* 2x2 inputs grid */}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {DEPARTMENTS.map((dep) => (
      <div key={dep.key} className="flex flex-col items-center">
        <label
          className="text-base font-semibold text-white drop-shadow mb-1 w-full"
          style={{
            textAlign: "center",
            fontFamily: "Montserrat, sans-serif",
            minHeight: 24,
            whiteSpace: "nowrap",
          }}
        >
          Target for {dep.label}
          <span className="text-sm font-normal opacity-70 pl-1">(days)</span>
        </label>
        <input
          type="number"
          min={0}
          value={typeof targets[selectedProject]?.[dep.key] === "number" ? targets[selectedProject][dep.key] : ""}
          onChange={e => handleTargetChange(dep.key, e.target.value)}
          className="w-full max-w-[150px] h-8 text-xl font-bold text-center text-black bg-white bg-opacity-90 rounded-xl border-none shadow focus:ring-2 focus:ring-blue-400 transition-all"
          disabled={loadingTargets}
          style={{
            outline: "none",
            boxShadow: "0 2px 8px 0 #0001",
            border: "1px solid #fff",
            marginTop: 4,
          }}
          placeholder="—"
        />
      </div>
    ))}
  </div>
</div>

  );
};

export default Phase4ClosureDashboard;
