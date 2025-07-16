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
    { name: "Project",                    type: "Text",   label: "Project" },
    { name: "year",                       type: "Text",   label: "Year" },
    { name: "Month",                      type: "Text",   label: "Month" },
    { name: "productionminutes",          type: "Number", label: "Production Minutes" },
    { name: "downtime",                   type: "Number", label: "Downtime" },
    { name: "rateofdowntime",             type: "Number", label: "Rate of Downtime" },
    { name: "Targetdowntime",             type: "Number", label: "Target Downtime (%)" },
    { name: "seuildinterventiondowntime", type: "Number", label: "Seuil Intervention Downtime (%)" },
  ];
  const drxFields: FieldDef[] = [
    { name: "year", type: "Text" ,label: "Year" },
    { name: "Month", type: "Text" ,label: "Month" },
    { name: "Quarter", type: "Text" ,label: "Quarter" },
    { name: "DRXIdeasubmittedIdea", type: "Number",label: " Submitted DRX Ideas" },
    { name: "DRXIdeasubmittedIdeaGoal", type: "Number" ,label: " DRX Ideas Submission Goal" },
  ];
  const budgetsFields: FieldDef[] = [
    { name: "year", type: "Text" ,label: "Year" },
    { name: "Month", type: "Text" ,label: "Month" },
    { name: "Quarter", type: "Text" ,label: "Quarter" },
    { name: "Budget", type: "Number" ,label: "Budget" },
    { name: "PlanifiedBudget", type: "Number" ,label: "Planified Budget" },
  ];
  const followFields: FieldDef[] = [
    { name: "Project", type: "Text" ,label:"Project" },
    { name: "Carline", type: "Text"  ,label:"Carline" },
    { name: "InitiationReasons", type: "Text" , label: "Initiation Reasons" },
    { name: "BucketID", type: "Text" ,label: "BucketID"},
    { name: "Date", type: "Text" ,label: "Date" },
    { name: "Statut", type: "Text" ,label:"Statut" },
    { name: "Monthlytarget", type: "Number" ,label:"Monthly Target" },
    { name: "Quantity", type: "Number" ,label:"Quantity"},
    { name: "NettValue", type: "Number" ,label:"Nett Value" },
    { name: "TotalNettValue", type: "Number" ,label:"Total Nett Value" },
    { name: "Currency", type: "Text" ,label:"Currency" },
    { name: "BucketResponsible", type: "Text" ,label:"Responsible" },
    { name: "PostnameID", type: "Text" ,label:"PostnameID" },
    { name: "Topic", type: "Text" ,label: "Topic"},
  ];
  const phase4Fields: FieldDef[] = [
    { name: "Project", type: "Text",label:"Project"},
    { name: "Department", type: "Text" ,label:"Department" },
    { name: "Target", type: "Number",label:"Target" },
  ];
const monthlyTargetFields: FieldDef[] = [
  { name: "Project",       type: "Text",   label: "Project"         },
  { name: "Year",          type: "Number", label: "Year"            },
  { name: "Month",         type: "Number", label: "Month (1–12)"    },
  { name: "MonthlyTarget", type: "Number", label: "Monthly Target (€)" },
];
  // 5️⃣ Uniqueness rules per list
  const uniqueKeysMap: Record<string, string[]> = {
    downtime: ["Project", "year", "Month"],
    DRX: ["year", "Month", "Quarter"],
    Budgets: ["year", "Month", "Quarter"],
    FollowCostKPI: ["BucketID"],
    Phase4Targets: ["Project", "Department"],
    MonthlyTargets: ["Project", "Year",   "Month"],
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
    { name: "MonthlyTargets", partial: "monthtarget", fields: monthlyTargetFields, hasProject: true, useExcelUploader: false},
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
