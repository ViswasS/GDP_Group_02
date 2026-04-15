const { assertCaseChatAccess } = require("./chat.access");
const { fetchMessages, sendMessage, generateAiSupportReply } = require("./chat.service");

async function listMessages(req, res, next) {
  try {
    const caseId = Number(req.validated.params.caseId);
    await assertCaseChatAccess(req.user, caseId);

    const { cursor, limit } = req.validated.query || {};
    const result = await fetchMessages({ caseId, cursor, limit });
    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}

async function createMessage(req, res, next) {
  try {
    const caseId = Number(req.validated.params.caseId);
    await assertCaseChatAccess(req.user, caseId);

    const { content, type, tempId } = req.validated.body;
    const message = await sendMessage({
      caseId,
      senderId: req.user.id,
      senderRole: req.user.role,
      content,
      type,
      tempId,
    });

    res.status(201).json({ success: true, data: message, message: "Message sent" });
  } catch (e) {
    next(e);
  }
}

async function aiSupportMessage(req, res, next) {
  try {
    const caseId = Number(req.validated.params.caseId);
    await assertCaseChatAccess(req.user, caseId);

    const result = await generateAiSupportReply({
      caseId,
      actor: req.user,
      patientQuestion: req.validated.body.message,
    });

    res.status(result?.created ? 201 : 200).json({
      success: true,
      data: result?.message || null,
      message: result?.created ? "AI reply created" : "AI reply skipped",
    });
  } catch (e) {
    next(e);
  }
}

module.exports = { listMessages, createMessage, aiSupportMessage };
