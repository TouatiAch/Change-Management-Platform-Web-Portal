import React, { useState} from "react";
import ExcelParser from "../components/DataUpload/ExcelParser";
import ColumnValidator from "../components/DataUpload/ColumnValidator";
import { useNavigate } from "react-router-dom";
import projectsIcon from "../assets/images/projectsIcon.png";
import EnsureSharePointLists from "../components/DataUpload/EnsureSharePointLists";
import harnessBg from "../assets/images/harness-bg.png";
import TopMenu from "../components/TopMenu";
import { getAccessToken } from "../auth/getToken";
import { msalInstance } from "../auth/msalInstance";
import { getConfig } from "../services/configService";
import axios from "axios";

import { trackEvent } from '../analytics/ga4';
import SiteResolver from "../components/DataUpload/SiteResolver";
import UploadQuestionTemplates from "../components/DataUpload/UploadQuestionTemplates";
import SharePointUploader from "../components/DataUpload/SharePointUploader";
import ExpectedColumnsDisplay from "../components/DataUpload/ExpectedColumnsDisplay";
import LogsViewer from "../components/DataUpload/LogsViewer";


const SharePointUploaderPage: React.FC = () => {
  const navigate = useNavigate();

  const [projectName, setProjectName] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [, setUploadComplete] = useState<boolean>(false);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [isPersonalSite] = useState<boolean>(false);
  const [siteUrl, setSiteUrl] = useState<string>("");
  const [data, setData] = useState<any[]>([]);
  const [columnsCleaned, setColumnsCleaned] = useState<string[]>([]);
  const [columnsRaw, setColumnsRaw] = useState<string[]>([]);
  const [columnsValid, setColumnsValid] = useState(false);
  const [, setQuestionsUploaded] = useState(false);
  const [questionTemplatesExist, setQuestionTemplatesExist] = useState(false);

  const log = (msg: string) => setLogs((prev) => [...prev, msg]);

  const handleUploadComplete = () => {
    setUploadComplete(true);
    log("✅ Upload complete.");
  };

  const handleSiteResolved = async (id: string, resolvedUrl: string) => {
    setSiteId(id);
    setSiteUrl(resolvedUrl);
    log(`✅ Using SharePoint Site ID: ${id}`);
     trackEvent('Site Resolved', { siteId: id });
    try {
      const token = await getAccessToken(msalInstance, ["Sites.Read.All"]);
      const config = getConfig();
      const questionsListId = config.questionsListId;

      const res = await axios.get(
        `https://graph.microsoft.com/v1.0/sites/${id}/lists/${questionsListId}/items?$top=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setQuestionTemplatesExist(res.data.value.length > 0);
    } catch (err) {
      log("⚠️ Unable to verify QuestionTemplates list content.");
      setQuestionTemplatesExist(false);
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-cover bg-center text-white text-lg" style={{ backgroundImage: `url(${harnessBg})` }}>
      <div className="absolute inset-0 z-10 pointer-events-none" />

      <div className="relative z-20 max-w-6xl mx-auto py-10 px-6 space-y-8">
        {/* Top Navigation Row */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-4">
            <button
              onClick={() => navigate("/tool-selection")}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur rounded-2xl shadow-md text-white text-sm transition"
            >
              ← Back
            </button>
          </div>
          <TopMenu />
        </div>

        {/* Title */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-[#00f0cc]">Excel → SharePoint List Converter</h2>
          <p className="text-lg text-white/80 mt-2">Change Management Platform – Data Extraction Tool</p>
        </div>

        <ExpectedColumnsDisplay />

        {/* Step 1: Ensure Lists */}
        {siteId && <EnsureSharePointLists siteId={siteId} onLog={log} />}

        {/* Step 2: Resolve Site */}
        <section className="bg-white/10 p-6 rounded-2xl shadow-md backdrop-blur-md border border-white/20">
          <h3 className="text-xl font-semibold mb-4">2. Resolve SharePoint Site</h3>
          <SiteResolver onResolved={handleSiteResolved} onLog={log} />
          {!siteId && (
            <p className="mt-2 text-sm text-yellow-100 italic">Please resolve the site before continuing.</p>
          )}
        </section>

        {/* Step 3: Upload Question Templates */}
        {siteId && !questionTemplatesExist && (
          <section className="bg-white/10 p-6 rounded-2xl shadow-md backdrop-blur-md border border-white/20">
            <h3 className="text-xl font-semibold mb-4">3. Upload Question Templates</h3>
            <UploadQuestionTemplates siteId={siteId} onLog={log} onComplete={() => setQuestionsUploaded(true)} />
          </section>
        )}

        {/* Step 4: Excel Upload */}
        <section className="bg-white/10 p-6 rounded-2xl shadow-md backdrop-blur-md border border-white/20">
          <h3 className="text-xl font-semibold mb-4">4. Upload Excel File with Changes</h3>
          <ExcelParser
            onDataParsed={(parsed, cleaned, raw) => {
              setData(parsed);
              setColumnsCleaned(cleaned);
              setColumnsRaw(raw);
              log(`✅ Excel parsed: ${parsed.length} rows, ${cleaned.length} columns`);
            }}
            onProjectNameDetected={setProjectName}
            onLog={log}
          />

          {columnsCleaned.length > 0 && (
            <ColumnValidator
              actualColumnsRaw={columnsRaw}
              actualColumnsCleaned={columnsCleaned}
              onValidationResult={(isValid) => setColumnsValid(isValid)}
            />
          )}
        </section>

        {/* Step 5: Upload to SharePoint */}
        {data.length > 0 && projectName && siteId && (
          <section className="bg-white/10 p-6 rounded-2xl shadow-md backdrop-blur-md border border-white/20">
            <h3 className="text-xl font-semibold mb-4">5. Upload Changes to SharePoint</h3>

            {!columnsValid ? (
              <p className="text-red-400 font-medium">
                ❌ Upload blocked: Please fix missing columns before uploading.
              </p>
            ) : (
              <>
                <SharePointUploader
                  data={data}
                  phase={"phase8"}
                  projectName={projectName}
                  siteId={siteId}
                  isPersonal={isPersonalSite}
                  siteUrl={siteUrl}
                  onLog={log}
                  onUploadComplete={handleUploadComplete}
                />

                <div className="flex flex-col sm:flex-row items-center justify-center gap-10 mt-10">
                  <button
                    onClick={() => navigate("/project-selection")}
                    
                    className="w-72 h-72 bg-white/20 backdrop-blur-md rounded-2xl shadow-lg hover:bg-white/30 hover:scale-105 transition transform duration-300 ease-in-out flex flex-col items-center justify-center text-white"
                  >
                    <img src={projectsIcon} alt="Projects" className="h-48 w-38 mb-6 object-contain" />
                    <span className="text-xl font-semibold">Check Projects</span>
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {/* Log Viewer */}
        <section className="bg-[#022b30] p-6 rounded-2xl shadow-md border border-white/20">
          <h3 className="text-xl font-semibold mb-4">Logs</h3>
          <div className="bg-white text-black rounded p-4 max-h-64 overflow-y-auto">
            <LogsViewer logs={logs} />
          </div>
        </section>
      </div>
    </div>
  );
};

export default SharePointUploaderPage;
