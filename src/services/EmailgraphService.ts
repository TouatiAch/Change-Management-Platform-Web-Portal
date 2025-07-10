// src/services/EmailgraphService.ts
import axios from "axios";
import { getGraphToken } from "../hooks/useGraphAuth";
import { ListsConfig, QuestionState } from "../pages/types";

interface GraphMessage {
  id: string;
  subject?: string;
  receivedDateTime: string;
  conversationId?: string;
  sender?: {
    emailAddress: {
      address: string;
    };
  };
}

export const graphService = {
  /** Load & merge ChangeQuestionStatus + QuestionTemplates */
  async listQuestions(projectKey: string, itemId: string): Promise<QuestionState[]> {

    // — 1) Config & Project
    const raw = localStorage.getItem("cmConfigLists");
    if (!raw) throw new Error("Configuration missing");
    const config: ListsConfig = JSON.parse(raw);
    const proj = config.projects.find(p => p.id === projectKey);
    if (!proj) throw new Error(`No project for key "${projectKey}"`);

    // — 2) Auth
    const token = await getGraphToken();
    if (!token) throw new Error("No Graph token");
    const headers = { Authorization: `Bearer ${token}` };

    // — 3) Fetch implementation item
    const implListId = proj.mapping.implementation;
    const itemResp = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${config.siteId}` +
      `/lists/${implListId}/items/${itemId}?expand=fields`,
      { headers }
    );
    const implFields = itemResp.data.fields;
    const processNum = implFields["Processnumber"] || "";
    const sheetArea  = implFields["SheetName"]    || "";

    // — 4) Fetch ChangeQuestionStatus
    const statusListId = proj.mapping.changeQuestionStatusListId;
    if (!statusListId) throw new Error("Missing ChangeQuestionStatus mapping");

    let statusItems: any[] = [];
    let url = `https://graph.microsoft.com/v1.0/sites/${config.siteId}` +
              `/lists/${statusListId}/items?$top=5000&expand=fields`;
    while (url) {
      const res = await axios.get(url, { headers });
      statusItems.push(...res.data.value);
      url = res.data["@odata.nextLink"] || null;
    }
    statusItems = statusItems.filter(it =>
      it.fields["ChangeNumber"] === processNum &&
      it.fields["Area"]         === sheetArea
    );

    // — 5) Fetch all QuestionTemplates
    let templates: any[] = [];
    let tUrl = `https://graph.microsoft.com/v1.0/sites/${config.siteId}` +
               `/lists/${config.questionsListId}/items?$top=5000&expand=fields`;
    while (tUrl) {
      const tres = await axios.get(tUrl, { headers });
      templates.push(...tres.data.value);
      tUrl = tres.data["@odata.nextLink"] || null;
    }

    // — 6) Normalize + merge
    const normalized = templates.map((item: any) => {
      const lc: Record<string, any> = {};
      for (const k in item.fields) lc[k.toLowerCase()] = item.fields[k];
      return { questionId: (lc["questionid"]||"").toLowerCase(), fields: lc };
    });

    const merged: QuestionState[] = statusItems.map((st: any) => {
      const raw = st.fields as Record<string, any>;
      // lowercase‐key version for case‐insensitive lookup
      const s: Record<string, any> = {};
      Object.entries(raw).forEach(([k, v]) => {
        s[k.toLowerCase()] = v;
      });

      const qid = (s["questionid"]||"").toLowerCase();
      const tpl = normalized.find(t => t.questionId === qid);

      let resp = false;
      if (typeof s["responsereceived"] === "boolean") resp = s["responsereceived"];
      else if (typeof s["responsereceived"] === "string")
        resp = s["responsereceived"].toLowerCase() === "true";

      return {
        id:                 st.id,
        changeNumber:       s["changenumber"]       || "",
        area:               s["area"]               || "",
        questionId:         s["questionid"]         || "",
        description:        tpl?.fields["question"] || "",
        action:             tpl?.fields["action"]   || "",
        responsibleEmail:   s["responsableemail"]   || tpl?.fields["responsableemail"] || "",
        responsibleRole:    s["responsiblerole"]    || "",
        triggerOn:          tpl?.fields["triggeron"] || "Oui",
        triggerChoice:      "",
        sendIntervalValue:  s["sendintervalvalue"] ?? tpl?.fields["sendintervalvalue"] ?? 3,
        sendIntervalUnit:   (s["sendintervalunit"]   || tpl?.fields["sendintervalunit"] || "Days") as any,
        emailbody:          tpl?.fields["emailbody"]    || "",
        emailsubject:       tpl?.fields["emailsubject"] || "",
        lastSent:           s["lastsent"]           || "",
        responseReceived:   resp,
        conversationId:     s["conversationid"]     || "",
        internetMessageId:  s["internetmessageid"]  || "",
        lastChecked:        s["lastchecked"]        || "",
        replySubject:       s["replysubject"]       || "",
        replyBody:          s["replybody"]          || "",
        replyReceivedDate:  s["replyreceiveddate"]  || "",
      };
    });

    return merged;
  },

  /** Fetch a single question by its status-item ID */
  async getQuestion(
    projectKey: string,
    _phase: string,
    itemId: string,
    questionId: string
  ): Promise<QuestionState> {
    const all = await this.listQuestions(projectKey, itemId);
    const q = all.find(x => x.id === questionId);
    if (!q) throw new Error(`No question found id="${questionId}"`);
    return q;
  },
  async patchField(
    questionStatusItemId: string,
    key: string,
    val: any
  ): Promise<void> {
    const raw = localStorage.getItem("cmConfigLists");
    if (!raw) { console.warn("[EGS] patchField aborted—missing cmConfigLists"); return; }
    const config: ListsConfig = JSON.parse(raw);

    // extract projectKey from hash
    const hash = window.location.hash;
    const path = hash.startsWith("#") ? hash.slice(1) : hash;
    const parts = path.split("/");
    const projectKey = parts[2];
    const proj = config.projects.find(p => p.id === projectKey);
    const listId = proj?.mapping.changeQuestionStatusListId;
    if (!listId) { console.warn("[EGS] patchField aborted—no listId for project", projectKey); return; }

    const token = await getGraphToken();
    if (!token) throw new Error("No Graph token for patchField");

    const url =
      `https://graph.microsoft.com/v1.0/sites/${config.siteId}` +
      `/lists/${listId}/items/${questionStatusItemId}/fields`;
    try {
    } catch (err: any) {
      console.error("🛠️ [EGS] patchField FAILED", { url, key, val, err });
      throw err;
    }
  },

  /** Save question (delegates to patchField) */
  async saveQuestion(q: QuestionState): Promise<void> {
    await this.patchField(q.id, "ResponsableEmail",   q.responsibleEmail);
    await this.patchField(q.id, "Responsiblerole",    q.responsibleRole);
    await this.patchField(q.id, "SendIntervalValue",  q.sendIntervalValue);
    await this.patchField(q.id, "SendIntervalUnit",   q.sendIntervalUnit);
    await this.patchField(q.id, "Action",             q.action);
    await this.patchField(q.id, "emailbody",          q.emailbody  || "");
    await this.patchField(q.id, "emailsubject",       q.emailsubject || "");
  },

  /** Send the email, then patch status fields back to SharePoint */
  async sendMail(q: QuestionState, fixedSubject: string): Promise<QuestionState> {
    const token = await getGraphToken();
    if (!token) throw new Error("No Graph token for sendMail");
    const headers = { Authorization: `Bearer ${token}` };

    const toRecipients = [{ emailAddress: { address: q.responsibleEmail }}];
    const ccRecipients = (q.cc||"").split(",")
      .map(e => e.trim())
      .filter(Boolean)
      .map(address => ({ emailAddress: { address }}));

    const subject = (q.emailsubject || "");
    const body    = `${q.action}\n\n${q.responsibleEmail}\n\n${q.emailbody||""}`;
    await axios.post(
      "https://graph.microsoft.com/v1.0/me/sendMail",
      { message: { subject, body: { contentType: "text", content: body }, toRecipients, ccRecipients }, saveToSentItems: true },
      { headers }
    );
    const sentResp = await axios.get(
      "https://graph.microsoft.com/v1.0/me/mailFolders/SentItems/messages?$top=1&$orderby=sentDateTime desc",
      { headers }
    );
    const message = sentResp.data.value[0];

    const now = new Date().toISOString();
    await this.patchField(q.id, "lastSent",         now);
    await this.patchField(q.id, "lastChecked",      now);
    await this.patchField(q.id, "responseReceived", false);
    await this.patchField(q.id, "conversationId",   message.conversationId);
    await this.patchField(q.id, "internetMessageId", message.internetMessageId);

    return {
      ...q,
      lastSent:         now,
      lastChecked:      now,
      responseReceived: false,
      conversationId:   message.conversationId,
      internetMessageId: message.internetMessageId
    };
  },

  /** Poll for a “Re:” reply */
async pollInboxFast(
  q: QuestionState,
  _fixedSubject: string
): Promise<QuestionState> {

  const token = await getGraphToken();
  if (!token) throw new Error("No Graph token for pollInboxFast");
  const headers = { Authorization: `Bearer ${token}` };

  if (!q.lastSent) {
    console.warn("[EGS] pollInboxFast: no lastSent, skipping");
    return q;
  }

  const fixedSubjLower = _fixedSubject
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\s+/g, " ");
  const lastSentTime   = new Date(q.lastSent);
  const expectedSender = q.responsibleEmail.toLowerCase();

  let url     =
    "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages" +
    "?$top=100&$orderby=receivedDateTime desc" +
    "&$select=id,subject,receivedDateTime,sender";
  let updatedQ = q;

  while (url) {
    const res = await axios.get<{
      value: GraphMessage[];
      "@odata.nextLink"?: string;
    }>(url, { headers });

    for (const msg of res.data.value) {
      const rawSubj = msg.subject || "";
      const subj = rawSubj
        .toLowerCase()
        .normalize("NFKD")
        .replace(/\u00A0/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const sender   = msg.sender?.emailAddress.address.toLowerCase() || "";
      const received = new Date(msg.receivedDateTime);
      const isReply  = subj.startsWith(`re: ${fixedSubjLower}`);
      const isSender = sender === expectedSender;
      const isAfter  = received > lastSentTime;

      if (isReply && isSender && isAfter) {
        // 1) fetch full body
        const full = await axios.get<{
          subject: string;
          body: { content: string };
          receivedDateTime: string;
        }>(
          `https://graph.microsoft.com/v1.0/me/messages/${msg.id}?$select=subject,body,receivedDateTime`,
          { headers }
        );

        const replySubject      = full.data.subject;
        const replyBody         = full.data.body.content;
        const replyReceivedDate = full.data.receivedDateTime;
        const now               = new Date().toISOString();

        // 2) patch all fields
        await this.patchField(q.id, "responseReceived",   true);
        await this.patchField(q.id, "lastChecked",        now);
        await this.patchField(q.id, "replySubject",       replySubject);
        await this.patchField(q.id, "replyBody",          replyBody);
        await this.patchField(q.id, "replyReceivedDate",  replyReceivedDate);

        // 3) return updated state
        return {
          ...q,
          responseReceived:  true,
          lastChecked:       now,
          replySubject,
          replyBody,
          replyReceivedDate
        };
      }
    }

    url = res.data["@odata.nextLink"] || "";
  }
  return updatedQ;
},
};
