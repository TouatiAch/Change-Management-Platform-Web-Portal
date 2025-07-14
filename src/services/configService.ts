// services/configService.ts

const LISTS_CONFIG_KEY = "cmConfigLists";

export interface IProject {
  id: string;
  displayName: string;
  logo?: string;
  mapping: {
    implementation: string;
    implementationExtra?: string;
    feasibilityExtra?: string;
    changeQuestionStatusListId?: string;
  };
}

/** One column in a SharePoint list */
export interface FieldDef {
  name: string;
  type: "Text" | "Number";
  label?: string;
}

/** Drives the generic CRUD or Excel-upload UI for a SharePoint list */
export interface ListConfig {
  /** logical key, e.g. "downtime", "Budgets", "FollowCostKPI", etc */
  name: string;
  siteId: string;
  listId: string;
  fields: FieldDef[];
  uniqueKeys: string[];
  hasProject?: boolean;
  useExcelUploader?: boolean;
}

/** Your entire app config stored in localStorage */
export interface cmConfigLists {
  /** SharePoint site where Questions list lives */
  siteId: string;

  /** Standalone Questions list */
  questionsListId: string;

  /** All other KPI lists (downtime, DRX, Budgets, etc) */
  lists: ListConfig[];

  /** Projects & their per-project list mappings */
  projects: IProject[];

  /** Optional role assignments */
  assignedRoles?: { email: string; role: string }[];

  /** Frequently used site URLs */
  frequentSites?: string[];
}

/** Load config from localStorage, with safe defaults */
export function getConfig(): cmConfigLists {
  const raw = localStorage.getItem(LISTS_CONFIG_KEY);
  if (!raw) {
    return {
      siteId: "",
      questionsListId: "",
      lists: [],
      projects: [],
      assignedRoles: [],
      frequentSites: [],
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<cmConfigLists>;
    return {
      siteId: parsed.siteId || "",
      questionsListId: parsed.questionsListId || "",
      lists: Array.isArray(parsed.lists) ? parsed.lists : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      assignedRoles: Array.isArray(parsed.assignedRoles) ? parsed.assignedRoles : [],
      frequentSites: Array.isArray(parsed.frequentSites) ? parsed.frequentSites : [],
    };
  } catch (err) {
    console.error("Invalid config format in localStorage:", err);
    return {
      siteId: "",
      questionsListId: "",
      lists: [],
      projects: [],
      assignedRoles: [],
      frequentSites: [],
    };
  }
}

/** Persist entire config back to localStorage */
export function saveConfig(config: cmConfigLists): void {
  localStorage.setItem(LISTS_CONFIG_KEY, JSON.stringify(config));
}

/**
 * Upsert (add or update) the Questions list ID.
 * Call this when you detect/create the QuestionTemplates list.
 */
export function setQuestionsListId(listId: string): void {
  const cfg = getConfig();
  cfg.questionsListId = listId;
  saveConfig(cfg);
}

/**
 * Upsert (add or update) one of your dynamic KPI lists.
 * E.g. downtime, DRX, Budgets, FollowCostKPI, Phase4Targets, etc.
 */
export function upsertListConfig(newList: ListConfig): void {
  const cfg = getConfig();
  // ensure lists array exists
  if (!Array.isArray(cfg.lists)) {
    cfg.lists = [];
  }
  const idx = cfg.lists.findIndex(l => l.name === newList.name);
  if (idx >= 0) {
    cfg.lists[idx] = { ...cfg.lists[idx], ...newList };
  } else {
    cfg.lists.push(newList);
  }
  saveConfig(cfg);
}

/**
 * Upsert a project mapping (unchanged).
 * Called when you detect or create per-project lists.
 */
export function upsertProjectMapping(
  projectId: string,
  displayName: string,
  phase: string,
  listId: string
): void {
  const cfg = getConfig();
  let project = cfg.projects.find(p => p.id === projectId.toLowerCase());

  if (!project) {
    project = {
      id: projectId.toLowerCase(),
      displayName,
      mapping: {
        implementation: "",
        implementationExtra: "",
        feasibilityExtra: "",
        changeQuestionStatusListId: "",
      },
    };
    cfg.projects.push(project);
  }

  if (phase === "phase4extra") {
    project.mapping.feasibilityExtra = listId;
  } else if (phase === "phase8") {
    project.mapping.implementation = listId;
  } else if (phase === "phase8extra") {
    project.mapping.implementationExtra = listId;
  } else if (phase === "changequestionstatus") {
    project.mapping.changeQuestionStatusListId = listId;
  }

  saveConfig(cfg);
}
