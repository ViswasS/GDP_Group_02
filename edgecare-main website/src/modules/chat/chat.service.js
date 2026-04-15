const { prisma } = require("../../db/prisma");
const { env } = require("../../config/env");
const { groqChatCompletion } = require("../../services/groqClient");

const SEVERITY_WORDS = new Set(["mild", "moderate", "severe", "uncertain", "low", "high", "unknown"]);

function symptomSelections(symptoms) {
  if (Array.isArray(symptoms)) return symptoms;
  if (Array.isArray(symptoms?.selected)) return symptoms.selected;
  return [];
}

async function getOrCreateConversation(caseId) {
  const cid = Number(caseId);
  const convo = await prisma.caseConversation.upsert({
    where: { caseId: cid },
    update: {},
    create: { caseId: cid },
  });
  return convo;
}

async function ensureConversationExists(caseId) {
  const cid = Number(caseId);
  const convo = await prisma.caseConversation.upsert({
    where: { caseId: cid },
    update: {},
    create: { caseId: cid },
  });
  return convo;
}

async function fetchMessages({ caseId, cursor, limit = 30 }) {
  const cid = Number(caseId);
  const conversation = await prisma.caseConversation.findUnique({
    where: { caseId: cid },
    select: { id: true },
  });

  if (!conversation) {
    return { items: [], nextCursor: null };
  }

  const messages = await prisma.caseMessage.findMany({
    where: {
      conversationId: conversation.id,
      ...(cursor ? { id: { lt: Number(cursor) } } : {}),
    },
    orderBy: { id: "desc" },
    take: limit + 1,
  });

  const hasNext = messages.length > limit;
  const items = hasNext ? messages.slice(0, limit) : messages;
  const itemsAsc = items.slice().reverse();
  const nextCursor = hasNext ? items[items.length - 1].id : null;

  // include caseId for client convenience
  return { items: itemsAsc.map((m) => ({ ...m, caseId: cid })), nextCursor };
}

async function sendMessage({
  caseId,
  senderId,
  senderRole,
  content,
  type = "TEXT",
  tempId = null,
  meta = null,
  messageType = "USER",
  forceCreate = false,
}) {
  const cid = Number(caseId);
  const convo = await getOrCreateConversation(cid);

  // normalize tempId
  const safeTempId = typeof tempId === "string" ? tempId.trim() : tempId;
  const useTempId = forceCreate || senderRole === "SYSTEM" ? null : (safeTempId ? safeTempId : null);

  let message;
  if (useTempId) {
    try {
      message = await prisma.caseMessage.upsert({
        where: { conversationId_tempId: { conversationId: convo.id, tempId: useTempId } },
        update: { content, type, ...(meta ? { metaJson: meta } : {}) },
        create: {
          conversationId: convo.id,
          tempId: useTempId,
          senderId: Number(senderId),
          senderRole,
          content,
          type,
          messageType,
          metaJson: meta || null,
        },
      });
    } catch (err) {
      if (err.code === "P2002") {
        message = await prisma.caseMessage.findUnique({
          where: { conversationId_tempId: { conversationId: convo.id, tempId: useTempId } },
        });
      } else {
        throw err;
      }
    }
  }

  if (!message) {
    message = await prisma.caseMessage.create({
      data: {
        conversationId: convo.id,
        tempId: null,
        senderId: Number(senderId),
        senderRole,
        content,
        type,
        messageType,
        metaJson: meta || null,
      },
    });
  }

  return { ...message, caseId: cid };
}

function safeConditionDisplay(fused = {}, mlImageResult = {}) {
  const fda = fused.final_disease_assessment;
  if (fda?.display_name && !SEVERITY_WORDS.has(String(fda.display_name).toLowerCase())) return fda.display_name;
  const gemini = fused.gemini_condition || fused.visual_condition_hint || fused.condition_name;
  if (gemini && !SEVERITY_WORDS.has(String(gemini).toLowerCase())) return gemini;
  const disease = fused.disease;
  if (disease?.display_name && !SEVERITY_WORDS.has(String(disease.display_name).toLowerCase())) return disease.display_name;
  const imgDisease = mlImageResult?.disease?.display_name || mlImageResult?.ml_analysis?.disease?.display_name;
  if (imgDisease && !SEVERITY_WORDS.has(String(imgDisease).toLowerCase())) return imgDisease;
  return "Possible skin issue detected";
}

function mapTriageToCareLevel(raw) {
  const v = String(raw || "").toLowerCase();
  if (["emergent", "emergency", "urgent", "high"].includes(v)) return "urgent_attention";
  if (["priority", "escalated", "moderate", "priority_review"].includes(v)) return "priority_review";
  if (["routine", "low", "mild", "review"].includes(v)) return "routine_review";
  return "home_care";
}

async function buildChatContext(caseId) {
  const cid = Number(caseId);
  const triageCase = await prisma.triageCase.findUnique({
    where: { id: cid },
    select: {
      id: true,
      status: true,
      assignedDoctorId: true,
      mlFusedResult: true,
      mlImageResult: true,
      mlSymptomsResult: true,
      intake: true,
      assignedDoctor: true,
      patient: true,
      result: true,
      images: true,
      triggers: true,
      spreadingStatus: true,
      severity: true,
      symptoms: true,
      imageUrls: true,
    },
  });

  if (!triageCase) return null;

  const fused = triageCase.mlFusedResult || {};
  const display = fused.display || {};
  const mlImageResult = triageCase.mlImageResult || {};
  const recommended = fused.recommended_actions || {};
  const actionCtas = display.action_ctas || {};
  const missing = [];
  if (!triageCase.intake?.medications) missing.push("medications");
  if (!triageCase.triggers) missing.push("triggers");
  if (triageCase.spreadingStatus === null || triageCase.spreadingStatus === undefined) missing.push("spreading_status");
  if (triageCase.severity === null || triageCase.severity === undefined) missing.push("severity");
  if (!symptomSelections(triageCase.symptoms).length) missing.push("symptoms");
  if (!triageCase.imageUrls?.length && !(triageCase.images?.length)) missing.push("photos");
  if (recommended.retake_required) missing.push("clear_photo");

  return {
    case_id: cid,
    case_status: triageCase.status,
    doctor_assigned: Boolean(triageCase.assignedDoctorId),
    assigned_doctor_name: triageCase.assignedDoctor
      ? [triageCase.assignedDoctor.firstName, triageCase.assignedDoctor.lastName].filter(Boolean).join(" ").trim() || null
      : null,
    possible_condition:
      display.show_condition_section === false ? "Condition unclear from image" : safeConditionDisplay(fused, mlImageResult),
    condition_status: fused.final_disease_assessment?.status || "uncertain",
    severity: display.severity_text || fused.final_severity_level || fused.severity || "Uncertain",
    triage_level: recommended.care_level || fused.triage_level || fused.triage || null,
    recommended_next_step:
      display.next_step_text ||
      (Array.isArray(recommended.items) && recommended.items[0]) ||
      fused.recommended_action ||
      fused.recommendation ||
      null,
    retake_required: display.retake_required ?? Boolean(recommended.retake_required),
    urgent_warning: display.show_urgent_badge === false ? null : recommended.urgent_warning || fused.urgent_warning || null,
    needs_clinician_review: Boolean(display.is_low_confidence || recommended.needs_clinician_review),
    summary: fused.ai_summary_text || fused.summary || "Preliminary AI screening only - not a confirmed diagnosis.",
    support_state: display.support_state || "AI_CHAT",
    support_prompt: display.support_prompt || null,
    allow_reupload: actionCtas.reupload_image !== false,
    allow_doctor_request: actionCtas.request_doctor !== false,
    missing_fields: missing,
  };
}

function applySafetyGuards(reply, context) {
  if (!reply) return null;
  let text = String(reply).trim();
  const lower = text.toLowerCase();

  if (context?.urgent_warning && !lower.includes("urgent")) {
    text = `- Urgent: ${context.urgent_warning}\n${text}`;
  }
  if (context?.needs_clinician_review && !lower.includes("clinician") && !lower.includes("doctor")) {
    text = `${text}\n- Review: Request a doctor if you want human review.`;
  }
  if (context?.retake_required && !lower.includes("photo") && !lower.includes("image")) {
    text = `${text}\n- Image: Upload a clearer, closer, well-lit photo.`;
  }
  if (text.length > 600) text = text.slice(0, 600);
  return text;
}

function classifyMessage(patientQuestion = "") {
  const lower = patientQuestion.toLowerCase();
  const urgentSignals = ["breathing", "swelling", "face swelling", "fever", "chills", "faint", "dizzy", "bleeding"];
  if (urgentSignals.some((w) => lower.includes(w))) return "urgent_red_flag";
  const unrelated = ["joke", "prime minister", "president", "football", "cricket", "code", "javascript", "love me", "date"];
  if (unrelated.some((w) => lower.includes(w))) return "irrelevant";
  if (lower.includes("spread") || lower.includes("itch") || lower.includes("pain")) return "symptom_clarification";
  if (lower.includes("took") || lower.includes("used") || lower.includes("applied") || lower.includes("medicin")) return "missing_info_response";
  if (lower.includes("serious") || lower.includes("urgent") || lower.includes("should i worry") || lower.includes("next step")) return "case_question";
  return "case_question";
}

async function generateAiSupportReply({ caseId, actor, patientQuestion }) {
  if (!env.GROQ_CHAT_ENABLED || !env.GROQ_API_KEY) {
    return { created: false, reason: "disabled" };
  }

  const context = await buildChatContext(caseId);
  if (!context) return { created: false, reason: "no_case" };
  const messageType = classifyMessage(patientQuestion);
  context.message_type = messageType;

  const systemPrompt = [
    "You are an AI support assistant for EdgeCare helping a patient with their current skin case before or while they wait for a clinician.",
    "Use only the provided case context.",
    "Never claim a confirmed diagnosis; describe conditions as possible or preliminary.",
    "If clinician review is needed, mention it.",
    "If an urgent warning exists, surface it clearly.",
    "If retake_required is true or support_state indicates a poor photo, ask for a clearer close-up, well-lit photo.",
    "If support_state is NO_OBVIOUS_RASH, explain that nothing obvious is visible in the image and suggest a re-upload if symptoms are real but not visible.",
    "If support_state is REUPLOAD_IMAGE, prioritize the re-upload guidance before deeper interpretation.",
    "If AI support may not be enough, remind the patient they can request a doctor review from the case page.",
    "Reply in 2-4 short bullet points using '- ' at the start of each bullet.",
    "Use this structure when relevant: assessment, next step, one focused follow-up question.",
    "Do not repeat the same disclaimer or summary text that is already shown elsewhere in the UI.",
    "Keep replies concise, calm, medically cautious, and specific to the current case.",
    "Do not prescribe medication; encourage clinician review for decisions.",
    "Only answer questions about the current skin case. If asked unrelated or personal questions, refuse briefly and redirect to case-related help.",
    "If important information is missing to answer safely, ask one focused follow-up question.",
  ].join(" ");

  const userPrompt = [
    "Case context:",
    JSON.stringify(context),
    "Patient asked:",
    patientQuestion,
  ].join("\n");

  console.info("[ai_chat_request_started]", { caseId, actorId: actor.id, role: actor.role });

  let aiText = null;
  try {
    const { content, modelUsed } = await groqChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    console.info("[ai_chat_groq_success]", { caseId, modelUsed });
    aiText = content;
  } catch (err) {
    if (err.code === "GROQ_DISABLED") return { created: false, reason: "disabled" };
    console.error("[ai_chat_groq_failure]", { caseId, error: err.message });
    aiText = [
      "- Update: AI support is currently unavailable.",
      "- Next: Follow the case summary shown on the left panel.",
      "- Review: Request a doctor if you want human review.",
    ].join("\n");
  }

  let guarded = applySafetyGuards(aiText, context) ||
    [
      "- Update: I could not prepare a response for this case right now.",
      "- Next: Follow the case summary shown on the left panel.",
      "- Review: Request a doctor if you want human review.",
    ].join("\n");

  if (["irrelevant", "general_question", "personal_question"].includes(messageType)) {
    guarded = "- Scope: I can only help with questions about this skin case.";
  }
  if (messageType === "urgent_red_flag" && !guarded.toLowerCase().includes("urgent")) {
    guarded = [
      "- Urgent: Your symptoms sound concerning.",
      "- Next: Seek urgent care now or contact a clinician right away.",
    ].join("\n");
  }

  const message = await sendMessage({
    caseId,
    senderId: 0,
    senderRole: "SYSTEM",
    content: guarded,
    type: "TEXT",
    tempId: null,
    meta: { source: "groq", ai_support_reply: true, caseId: Number(caseId) },
    messageType: "AI_SUPPORT",
    forceCreate: true,
  });

  console.info("[ai_chat_reply_saved]", { caseId, messageId: message.id });

  return { created: true, message };
}

module.exports = { fetchMessages, sendMessage, ensureConversationExists, generateAiSupportReply };
