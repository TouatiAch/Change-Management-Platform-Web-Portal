// src/services/siteLookupService.ts

import axios from "axios";
import { msalInstance } from "../auth/msalInstance";
import { getAccessToken } from "../auth/getToken";
import { getProjectLogo } from "../utils/getProjectLogo";
import {
  getConfig,
  saveConfig,
  setQuestionsListId,
  upsertListConfig,
  FieldDef,
  ListConfig,
  IProject,
} from "../services/configService";

/** Normalize project IDs */
function canonicalProjectId(input: string): string {
  let normalized = input.trim().toLowerCase().replace(/[\s_]+/g, "-");
  const aliasMap: Record<string, string> = {
    mercedes: "mercedes-benz",
    merc: "mercedes-benz",
    "mercedes-benz": "mercedes-benz",
    mercedesbenz: "mercedes-benz",
    vw: "volkswagen",
  };
  return aliasMap[normalized] ?? normalized;
}

/**
 * Finds or creates your KPI lists and QuestionTemplates in SharePoint,
 * then saves all IDs + project mappings into your new config shape.
 */
export async function lookupSiteAndLists(
  siteName: string,
  existingProjects: IProject[],
  frequentSites: string[]
) {
  // 1️⃣ Authenticate & resolve site
  const account = msalInstance.getActiveAccount();
  if (!account) throw new Error("Please log in first.");
  const token = await getAccessToken(msalInstance, [
    "https://graph.microsoft.com/Sites.Read.All",
  ]);
  if (!token) throw new Error("No access token.");

  const url = new URL(siteName);
  const path = `${url.hostname}:${url.pathname}:`;
  const siteResp = await axios.get<{ id: string }>(
    `https://graph.microsoft.com/v1.0/sites/${path}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const siteId = siteResp.data.id;

  // 2️⃣ Fetch all lists in site
  const listsResp = await axios.get<{ value: any[] }>(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const fetchedLists = listsResp.data.value;

  const findListId = (partial: string) =>
    fetchedLists.find((l: any) =>
      l.displayName.toLowerCase().includes(partial.toLowerCase())
    )?.id || "";

  // 3️⃣ QuestionTemplates remains standalone
  const questionListId = findListId("question");
  setQuestionsListId(questionListId);

  // 4️⃣ Define your KPI lists' fields
  const downtimeFields: FieldDef[] = [
    { name: "Project", type: "Text" },
    { name: "year", type: "Text" },
    { name: "Month", type: "Text" },
    { name: "Monthid", type: "Text" },
    { name: "productionminutes", type: "Number" },
    { name: "downtime", type: "Number" },
    { name: "rateofdowntime", type: "Number" },
    { name: "Targetdowntime", type: "Number" },
    { name: "seuildinterventiondowntime", type: "Number" },
  ];
  const drxFields: FieldDef[] = [
    { name: "year", type: "Text" },
    { name: "Month", type: "Text" },
    { name: "Quarter", type: "Text" },
    { name: "DRXIdeasubmittedIdea", type: "Number" },
    { name: "DRXIdeasubmittedIdeaGoal", type: "Number" },
  ];
  const budgetsFields: FieldDef[] = [
    { name: "year", type: "Text" },
    { name: "Month", type: "Text" },
    { name: "Quarter", type: "Text" },
    { name: "Budget", type: "Number" },
    { name: "PlanifiedBudget", type: "Number" },
  ];
  const followFields: FieldDef[] = [
    { name: "Project", type: "Text" },
    { name: "Carline", type: "Text" },
    { name: "InitiationReasons", type: "Text" },
    { name: "BucketID", type: "Text" },
    { name: "Date", type: "Text" },
    { name: "Statut", type: "Text" },
    { name: "Quantity", type: "Number" },
    { name: "NettValue", type: "Number" },
    { name: "TotalNettValue", type: "Number" },
    { name: "Currency", type: "Text" },
    { name: "BucketResponsible", type: "Text" },
    { name: "PostnameID", type: "Text" },
    { name: "Topic", type: "Text" },
  ];
  const phase4Fields: FieldDef[] = [
    { name: "Project", type: "Text" },
    { name: "Department", type: "Text" },
    { name: "Target", type: "Number" },
  ];

  // 5️⃣ Uniqueness rules per list
  const uniqueKeysMap: Record<string, string[]> = {
    downtime: ["Project", "year", "Month"],
    DRX: ["year", "Month", "Quarter"],
    Budgets: ["year", "Month", "Quarter"],
    FollowCostKPI: ["BucketID"],
    Phase4Targets: ["Project", "Department"],
  };

  // 6️⃣ Upsert each KPI list into config.lists
  const dynamicLists: Array<{
    name: string;
    partial: string;
    fields: FieldDef[];
    hasProject: boolean;
    useExcelUploader: boolean;
  }> = [
    { name: "downtime",       partial: "downtime", fields: downtimeFields, hasProject: true,  useExcelUploader: false },
    { name: "DRX",            partial: "drx",      fields: drxFields,      hasProject: false, useExcelUploader: false },
    { name: "Budgets",        partial: "budget",   fields: budgetsFields,  hasProject: false, useExcelUploader: false },
    { name: "FollowCostKPI",  partial: "follow",   fields: followFields,   hasProject: true,  useExcelUploader: true  },
    { name: "Phase4Targets",  partial: "target",   fields: phase4Fields,   hasProject: true,  useExcelUploader: false },
  ];

  for (const def of dynamicLists) {
    const listId = findListId(def.partial);
    if (!listId) {
      console.warn(`List not found for '${def.name}'`);
      continue;
    }
    const cfg: ListConfig = {
      name:             def.name,
      siteId,
      listId,
      fields:           def.fields,
      uniqueKeys:       uniqueKeysMap[def.name] || [],
      hasProject:       def.hasProject,
      useExcelUploader: def.useExcelUploader,
    };
    upsertListConfig(cfg);
  }

  // 7️⃣ Extract per-project list mappings (unchanged)
  const regex = /^changes_([A-Za-z0-9-]+)_phase(4|8)(extra)?$/i;
  const newProjMap: Record<string, IProject> = {};
  fetchedLists.forEach((l: any) => {
    const m = regex.exec(l.displayName);
    if (!m) return;
    const [ , raw, phase, extra ] = m;
    const pid = canonicalProjectId(raw);
    const exist = newProjMap[pid] || existingProjects.find(p => canonicalProjectId(p.id) === pid);

    const upd: IProject = exist
      ? { ...exist }
      : {
          id: pid,
          displayName: raw,
          logo: getProjectLogo(pid),
          mapping: {
            implementation: "",
            feasibilityExtra: "",
            implementationExtra: "",
            changeQuestionStatusListId: "",
          },
        };

    if (phase === "4"  && extra) upd.mapping.feasibilityExtra = l.id;
    if (phase === "8"  && extra) upd.mapping.implementationExtra = l.id;
    if (phase === "8"  && !extra) upd.mapping.implementation = l.id;
    newProjMap[pid] = upd;
  });
  // ChangeQuestionStatus lists
  fetchedLists.forEach((l: any) => {
    const m = /^ChangeQuestionStatus_([A-Za-z0-9-]+)$/i.exec(l.displayName);
    if (!m) return;
    const pid = canonicalProjectId(m[1]);
    if (newProjMap[pid]) newProjMap[pid].mapping.changeQuestionStatusListId = l.id;
  });
  const finalProjects = Object.values(newProjMap);

  // 8️⃣ Persist siteId, projects, frequentSites
  const cfg = getConfig();
  cfg.siteId = siteId;
  cfg.projects = finalProjects;
  cfg.frequentSites = Array.from(new Set([...frequentSites, siteName]));
  saveConfig(cfg);

  return { config: cfg, projects: finalProjects , fetchedLists,};
}
