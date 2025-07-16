// src/components/EnsureSharePointLists.tsx

import React, { useState } from "react";
import axios from "axios";
import { getAccessToken } from "../../auth/getToken";
import { msalInstance } from "../../auth/msalInstance";
import {
  getConfig,
  saveConfig,
  setQuestionsListId,
  upsertListConfig,
  FieldDef,
  ListConfig,
} from "../../services/configService";

interface Props {
  siteId: string;
  onLog: (msg: string) => void;
}

/**  
 * We keep QuestionTemplates & users exactly as before,
 * then define one list per logical KPI group.
 */
const REQUIRED_LISTS: Array<{ name: string; fields: FieldDef[] }> = [
  {
    name: "QuestionTemplates",
    fields: [
      { name: "Questionid",        type: "Text"   },
      { name: "Question",          type: "Text"   },
      { name: "TriggerOn",         type: "Text"   },
      { name: "ResponsableEmail",  type: "Text"   },
      { name: "SendIntervalValue", type: "Number" },
      { name: "SendIntervalUnit",  type: "Text"   },
      { name: "Action",            type: "Text"   },
      { name: "Responsiblerole",   type: "Text"   },
      { name: "emailbody",         type: "Text"   },
      { name: "emailsubject",      type: "Text"   },
    ],
  },
  {
    name: "users",
    fields: [
      { name: "email",       type: "Text" },
      { name: "role",        type: "Text" },
      { name: "name",        type: "Text" },
      { name: "permissions", type: "Text" },
    ],
  },
  {
    name: "downtime",
    fields: [
      { name: "Project",                       type: "Text"   },
      { name: "year",                          type: "Text"   },
      { name: "Month",                         type: "Text"   },
      { name: "productionminutes",             type: "Number" },
      { name: "downtime",                      type: "Number" },
      { name: "rateofdowntime",                type: "Number" },
      { name: "Targetdowntime",                type: "Number" },
      { name: "seuildinterventiondowntime",    type: "Number" },
    ],
  },
  {
    name: "DRX",
    fields: [
      { name: "year",                       type: "Text"   },
      { name: "Month",                      type: "Text"   },
      { name: "Quarter",                    type: "Text"   },
      { name: "DRXIdeasubmittedIdea",       type: "Number" },
      { name: "DRXIdeasubmittedIdeaGoal",   type: "Number" },
    ],
  },
  {
    name: "Budgets",
    fields: [
      { name: "year",             type: "Text"   },
      { name: "Month",            type: "Text"   },
      { name: "Quarter",          type: "Text"   },
      { name: "Budget",           type: "Number" },
      { name: "PlanifiedBudget",  type: "Number" },
    ],
  },
  {
    name: "FollowCostKPI",
    fields: [
      { name: "Project",            type: "Text"   },
      { name: "Carline",            type: "Text"   },
      { name: "InitiationReasons",  type: "Text"   },
      { name: "BucketID",           type: "Text"   },
      { name: "Date",               type: "Text"   },
      { name: "Monthlytarget",      type: "Number" },
      { name: "Statut",             type: "Text"   },
      { name: "Quantity",           type: "Number" },
      { name: "NettValue",          type: "Number" },
      { name: "TotalNettValue",     type: "Number" },
      { name: "Currency",           type: "Text"   },
      { name: "BucketResponsible",  type: "Text"   },
      { name: "PostnameID",         type: "Text"   },
      { name: "Topic",              type: "Text"   },
    ],
  },
  {
    name: "Phase4Targets",
    fields: [
      { name: "Project",    type: "Text"   },
      { name: "Department", type: "Text"   },
      { name: "Target",     type: "Number" },
    ],
  },
  {
  name: "MonthlyTargets", 
  fields: [
    { name: "Project",  type: "Text" },
    { name: "Year",     type: "Number" },
    { name: "Month",    type: "Number" },
    { name: "Monthlytarget", type: "Number" },
  ]
},

];

const UNIQUE_KEYS: Record<string, string[]> = {
  QuestionTemplates: ["Questionid"],
  users:             ["email"],
  downtime:          ["Project","year","Month"],
  DRX:               ["year","Month","Quarter"],
  Budgets:           ["year","Month","Quarter"],
  FollowCostKPI:     ["BucketID"],
  Phase4Targets:     ["Project","Department"],
MonthlyTargets: ["Project","Year","Month"]
};

const EnsureSharePointLists: React.FC<Props> = ({ siteId, onLog }) => {
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateLists = async () => {
    setIsCreating(true);
    try {
      const token = await getAccessToken(msalInstance, ["Sites.Manage.All"]);
      const resp = await axios.get(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$select=displayName,id`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const existing = resp.data.value as Array<{ displayName: string; id: string }>;
      const existingNames = new Set(existing.map((l) => l.displayName));

      for (const def of REQUIRED_LISTS) {
        let listId: string;
        if (!existingNames.has(def.name)) {
          onLog(`ℹ️ Creating '${def.name}'…`);
          const create = await axios.post(
            `https://graph.microsoft.com/v1.0/sites/${siteId}/lists`,
            {
              displayName: def.name,
              columns: def.fields.map((f) => ({
                name: f.name,
                text: f.type === "Text" ? {} : undefined,
                number: f.type === "Number" ? {} : undefined,
              })),
              list: { template: "genericList" },
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );
          listId = create.data.id;
          onLog(`✅ Created '${def.name}' (ID: ${listId})`);
        } else {
          listId = existing.find((l) => l.displayName === def.name)!.id;
          onLog(`ℹ️ '${def.name}' exists (ID: ${listId})`);
        }

        if (def.name === "QuestionTemplates") {
          // remains standalone
          setQuestionsListId(listId);
        } else {
          // dynamic KPI lists
          const cfg: ListConfig = {
            name:             def.name,
            siteId,
            listId,
            fields:           def.fields,
            uniqueKeys:       UNIQUE_KEYS[def.name] || [],
            hasProject:       def.fields.some((f) => f.name === "Project"),
            useExcelUploader: def.name === "FollowCostKPI",
          };
          upsertListConfig(cfg);
        }
      }

      // persist the updated siteId + lists + questionsListId
      const finalCfg = getConfig();
      finalCfg.siteId = siteId;
      saveConfig(finalCfg);

      onLog("✅ All lists ensured and configuration saved.");
    } catch (err: any) {
      onLog(`❌ Error: ${err.response?.data?.error?.message || err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="my-6">
      <button
        disabled={isCreating}
        onClick={handleCreateLists}
        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isCreating
          ? "Checking/Creating Lists…"
          : "🔧 Ensure Required SharePoint Lists Exist"}
      </button>
    </div>
  );
};

export default EnsureSharePointLists;
