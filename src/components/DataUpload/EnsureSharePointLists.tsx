import React, { useState } from "react";
import axios from "axios";
import { getAccessToken } from "../../auth/getToken";
import { msalInstance } from "../../auth/msalInstance";
import { getConfig, saveConfig } from "../../services/configService";

interface Props {
  siteId: string;
  onLog: (msg: string) => void;
}

const REQUIRED_LISTS = [
  {
    name: "MonthlyKPIs",
    fields: [
      { name: "Project", type: "Text" },
      { name: "year", type: "Text" },
      { name: "Month", type: "Text" },
      { name: "Monthid", type: "Text" },
      { name: "DRXIdeasubmittedIdea", type: "Number" },
      { name: "DRXIdeasubmittedIdeaGoal", type: "Number" },
      { name: "productionminutes", type: "Number" },
      { name: "downtime", type: "Number" },
      { name: "rateofdowntime", type: "Number" },
      { name: "Targetdowntime", type: "Number" },
      { name: "seuildinterventiondowntime", type: "Number" },
    ],
  },
  {
    name: "Budgets",
    fields: [
      { name: "Project", type: "Text" },
      { name: "year", type: "Text" },
      { name: "Month", type: "Text" },
      { name: "Category", type: "Text" },
      { name: "Budgetdepartment", type: "Number" },
      { name: "Budgetdepartmentplanified", type: "Number" },
    ],
  },
  {
    name: "QuestionTemplates",
    fields: [
      { name: "Questionid", type: "Text" },
      { name: "Question", type: "Text" },
      { name: "TriggerOn", type: "Text" },
      { name: "ResponsableEmail", type: "Text" },
      { name: "SendIntervalValue", type: "Number" },
      { name: "SendIntervalUnit", type: "Text" },
      { name: "Action", type: "Text" },
      { name: "Responsiblerole", type: "Text" },
      { name: "emailbody", type: "Text" },
      { name: "emailsubject", type: "Text" },
    ],
  },
  {
    name: "FollowCostKPI",
    fields: [
      { name: "Project", type: "Text" },
      { name: "Area", type: "Text" },
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
    ],
  },
  {
    name: "users",
    fields: [
      { name: "email", type: "Text" },
      { name: "role", type: "Text" },
      { name: "name", type: "Text" },
      { name: "permissions", type: "Text" },
    ],
  },
  // New required list for phase 4 targets
  {
    name: "Phase4Targets",
    fields: [
      { name: "Project", type: "Text" },
      { name: "Department", type: "Text" }, // e.g., PaV, QS, PSCR, Logistic
      { name: "Target", type: "Number" },
    ],
  },
];

const EnsureSharePointLists: React.FC<Props> = ({ siteId, onLog }) => {
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateLists = async () => {
    try {
      setIsCreating(true);
      const token = await getAccessToken(msalInstance, ["Sites.Manage.All"]);
      const existingLists = await axios.get(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$select=displayName,id`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const existingNames = existingLists.data.value.map((list: { displayName: string }) => list.displayName);

      const currentConfig = getConfig();
      const updatedConfig = { ...currentConfig };

      for (const list of REQUIRED_LISTS) {
        if (!existingNames.includes(list.name)) {
          const createdList = await axios.post(
            `https://graph.microsoft.com/v1.0/sites/${siteId}/lists`,
            {
              displayName: list.name,
              columns: list.fields.map((f) => ({
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

          const listId = createdList.data.id;
          switch (list.name) {
            case "MonthlyKPIs":
              updatedConfig.monthlyListId = listId;
              break;
            case "Budgets":
              updatedConfig.budgetsListId = listId;
              break;
            case "QuestionTemplates":
              updatedConfig.questionsListId = listId;
              break;
            case "FollowCostKPI":
              updatedConfig.followCostListId = listId;
              break;
            case "users":
              updatedConfig.usersListId = listId;
              break;
            case "Phase4Targets":
              updatedConfig.phase4TargetsListId = listId;
              break;
          }

          onLog(`✅ Created list '${list.name}'`);
        } else {
          onLog(`ℹ️ List '${list.name}' already exists.`);
          // Add this to patch config if missing:
          const existingListInfo = existingLists.data.value.find(
            (l: { displayName: string; id: string }) => l.displayName === list.name
          );
          if (existingListInfo && existingListInfo.id) {
            switch (list.name) {
              case "MonthlyKPIs":
                updatedConfig.monthlyListId = existingListInfo.id;
                break;
              case "Budgets":
                updatedConfig.budgetsListId = existingListInfo.id;
                break;
              case "QuestionTemplates":
                updatedConfig.questionsListId = existingListInfo.id;
                break;
              case "FollowCostKPI":
                updatedConfig.followCostListId = existingListInfo.id;
                break;
              case "users":
                updatedConfig.usersListId = existingListInfo.id;
                break;
              case "Phase4Targets":
                updatedConfig.phase4TargetsListId = existingListInfo.id;
                break;
            }
          }
        }
      }
      updatedConfig.siteId = siteId;
      saveConfig(updatedConfig);
      onLog("✅ Configuration saved to localStorage.");
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
        {isCreating ? "Checking/Creating Lists..." : "🔧 Ensure Required SharePoint Lists Exist"}
      </button>
    </div>
  );
};

export default EnsureSharePointLists;
