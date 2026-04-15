const express = require("express");
const { requireAuth } = require("../../common/middleware/auth");
const { validate } = require("../../common/middleware/validate");
const { getMessagesSchema, sendMessageSchema, aiReplySchema } = require("./chat.schemas");
const controller = require("./chat.controller");

const caseChatRouter = express.Router({ mergeParams: true });

caseChatRouter.get("/messages", requireAuth, validate(getMessagesSchema), controller.listMessages);
caseChatRouter.post("/messages", requireAuth, validate(sendMessageSchema), controller.createMessage);
caseChatRouter.post("/ai", requireAuth, validate(aiReplySchema), controller.aiSupportMessage);

module.exports = { caseChatRouter };
