const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { env, corsOrigins } = require("./config/env");
const { canAccessCaseChat, assertCaseChatAccess } = require("./modules/chat/chat.access");
const { sendMessage, ensureConversationExists } = require("./modules/chat/chat.service");
const { ApiError } = require("./common/errors/ApiError");

function emitError(socket, err, extra = {}) {
  const payload = {
    code: err.statusCode || err.code || "ERROR",
    message: err.message || "Unknown error",
    ...extra,
  };
  socket.emit("case:error", payload);
}

let ioInstance = null;

function initSocket(server) {
  if (ioInstance) return ioInstance;

  const io = new Server(server, {
    cors: {
      origin: corsOrigins,
      methods: ["GET", "POST"],
    },
  });

  io.use((socket, next) => {
    try {
      const header = socket.handshake.auth?.token || socket.handshake.headers.authorization;
      const token = typeof header === "string" && header.startsWith("Bearer ")
        ? header.split(" ")[1]
        : socket.handshake.auth?.token || header;

      if (!token) return next(new Error("UNAUTHORIZED"));
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
      socket.data.user = { id: Number(payload.sub), role: payload.role, email: payload.email };
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;

    socket.on("case:join", async ({ caseId }) => {
      try {
        const allowed = await canAccessCaseChat(user, caseId);
        if (!allowed) throw new ApiError(403, "Forbidden");
        await ensureConversationExists(caseId);
        const room = `case:${Number(caseId)}`;
        socket.join(room);
        socket.emit("case:joined", { caseId: Number(caseId) });
      } catch (err) {
        emitError(socket, err, { caseId });
      }
    });

    socket.on("case:message:send", async (payload = {}, cb) => {
      const { caseId, tempId, content, type = "TEXT" } = payload;
      try {
        if (!caseId || !content) throw new ApiError(400, "caseId and content are required");
        await assertCaseChatAccess(user, caseId);
        const message = await sendMessage({
          caseId,
          senderId: user.id,
          senderRole: user.role,
          content,
          type,
          tempId,
        });

        const room = `case:${Number(caseId)}`;
        io.to(room).emit("case:message:new", { ...message, tempId });
        socket.emit("case:message:sent", { tempId, id: message.id, caseId: Number(caseId) });
        if (typeof cb === "function") cb({ success: true, data: { ...message, tempId } });
      } catch (err) {
        emitError(socket, err, { tempId, caseId });
        if (typeof cb === "function") {
          cb({
            success: false,
            code: err.statusCode || err.code || "ERROR",
            message: err.message || "Unknown error",
            tempId,
            caseId,
          });
        }
      }
    });
  });

  ioInstance = io;
  return ioInstance;
}

module.exports = { initSocket };
