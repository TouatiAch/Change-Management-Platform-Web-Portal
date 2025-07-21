// src/App.tsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage                 from "./pages/LoginPage";
import ConfigPage                from "./pages/ConfigPage";
import ProjectSelection          from "./pages/ProjectSelection";
import PhaseSelectionPage        from "./pages/PhaseSelectionPage";
import ChangeItemsImplementation from "./pages/ChangeItemsImplementation";
import ChangeItemsFeasibility    from "./pages/ChangeItemsFeasibility";
import DetailsImplementation     from "./pages/DetailsImplementation";
import DetailsFeasibility        from "./pages/DetailsFeasibility";
import NotFoundPage              from "./pages/NotFoundPage";

import DashboardHome             from "./pages/DashboardHome";
import DashboardPage             from "./pages/DashboardPage";
import DashboardLayout           from "./components/dashboard/DashboardLayout";

import AddQuestionPage           from "./pages/AddQuestionPage";
import QuestionsListPage         from "./pages/QuestionsListPage";
import SendEmailPage             from "./pages/SendEmailPage";

import ToolSelectionPage         from "./pages/ToolSelectionPage";
import SharePointUploaderPage    from "./pages/SharePointUploaderPage";

import ScrapFollowingSection     from "./pages/ScrapFollowingSection";
import DRXKPIEditor              from "./pages/DRXKPIEditor";
import DowntimeKPIEditor         from "./pages/DowntimeKPIEditor";
import BudgetKPIEditor           from "./pages/BudgetKPIEditor";
import FollowCostKPIEditor       from "./pages/FollowCostKPIEditor";

import KPIInputPage              from "./pages/KPIInputPage";
import Phase4KPIInput            from "./components/kpiEntry/Phase4KPIInput";
import FollowUpExcelUploader     from "./components/kpiEntry/FollowUpExcelUploader";

import { getConfig }             from "./services/configService";
import DowntimeListManager from "./components/kpiEntry/DowntimeListManager";
import BudgetsListManager from "./components/kpiEntry/BudgetsListManager";
import DrxListManager from "./components/kpiEntry/DrxListManager";
import UserProfilePage from "./pages/UserProfilePage";
const App: React.FC = () => {
  // grab your saved config once
  const cfg = getConfig();

  return (
    <Routes>
      {/* 1) Auth & Landing */}
      <Route index element={<LoginPage />} />
      <Route path="/tool-selection" element={<ToolSelectionPage />} />
      <Route path="/data-extraction" element={<SharePointUploaderPage />} />

      {/* 2) Configuration */}
      <Route path="/config" element={<ConfigPage />} />

      {/* 3) Change‐management flow */}
      <Route path="/project-selection" element={<ProjectSelection />} />
      <Route path="/changes/:projectKey" element={<PhaseSelectionPage />} />
      <Route path="/changes/:projectKey/implementation" element={<ChangeItemsImplementation />} />
      <Route path="/details/:projectKey/implementation/:itemId" element={<DetailsImplementation />} />
      <Route path="/changes/:projectKey/feasibility" element={<ChangeItemsFeasibility />} />
      <Route path="/details/:projectKey/feasibility/:itemId" element={<DetailsFeasibility />} />

      <Route path="/send-email/:projectKey/:phase/:itemId"      element={<QuestionsListPage />} />
      <Route path="/send-email/:projectKey/:phase/:itemId/add-question" element={<AddQuestionPage />} />
      <Route path="/send-email/:projectKey/:phase/:itemId/:questionId" element={<SendEmailPage />} />

      {/* extra phases */}
      <Route path="/changes/:projectKey/implementation-extra" element={<ChangeItemsImplementation />} />
      <Route path="/changes/:projectKey/feasibility-extra"    element={<ChangeItemsFeasibility />} />

      {/* 4) Dashboard section */}
      <Route path="/dashboard/*" element={<DashboardLayout />}>
        <Route index element={<DashboardHome />} />
        <Route path=":project" element={<DashboardPage />} />
      </Route>

      {/* 5) KPI section */}
      <Route path="/" element={<Navigate to="/kpis/downtime" replace />} />
      <Route path="/kpis/*" element={<KPIInputPage />}>
        {/* default to downtime */}
        <Route index element={<Navigate to="downtime" replace />} />

        <Route path="scrap"         element={<ScrapFollowingSection />} />
        <Route path="downtime" element={<DowntimeListManager />} />
        <Route path="drx"      element={<DrxListManager />} />
        <Route path="budgets"  element={<BudgetsListManager />} />
        <Route
          path="followcostkpi"
          element={
            <FollowUpExcelUploader
              siteId={cfg.siteId}
              listId={cfg.lists.find(l => l.name === "FollowCostKPI")?.listId || ""}
              projects={cfg.projects}
              onComplete={() => {/* maybe toast or reload */}}
            />
          }
        />
        <Route path="phase4targets" element={<Phase4KPIInput />} />

        {/* any unknown → go back to downtime */}
        <Route path="*" element={<Navigate to="downtime" replace />} />
      </Route>

      {/* 6) Legacy editors / fallbacks */}
      <Route path="/kpi-editor/drx"      element={<DRXKPIEditor />} />
      <Route path="/kpi-editor/downtime" element={<DowntimeKPIEditor />} />
      <Route path="/kpi-editor/budget"   element={<BudgetKPIEditor />} />
      <Route path="/follow-cost-editor"  element={<FollowCostKPIEditor />} />
      <Route path="/user-profile" element={<UserProfilePage />} />

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default App;
