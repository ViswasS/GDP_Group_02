(function () {
  // Singleton socket + listener guard across all inits
  let socketSingleton = null;
  let listenersBound = false;
  let activeInitKey = null;
  let initInProgress = false;

  const EdgeCareChat = {
    _initializedCaseId: null,
    _api: null,
    async init(options = {}) {
      const params = new URLSearchParams(window.location.search);
      const caseId = Number(options.caseId || params.get("id"));
      if (!caseId) return;

      const key = `case:${caseId}`;
      if (initInProgress && activeInitKey === key) return;
      initInProgress = true;
      activeInitKey = key;
      this._initializedCaseId = caseId;


      const chatSub = document.getElementById("chatSub");
      const messagesEl = document.getElementById("chat-messages");
      const inputEl = document.getElementById("chatInput");
      const sendBtn = document.getElementById("chatSendBtn");
      const loadOlderBtn = document.getElementById("chat-load-older");
      const loadStateEl = document.getElementById("chat-load-state");
      const errorBanner = document.getElementById("chat-error");
      const statusDot = document.getElementById("chat-status-dot");
      const statusText = document.getElementById("chat-status-text");

      if (!messagesEl || !inputEl || !sendBtn) {
        initInProgress = false;
        return;
      }

      const state = {
        currentUser: null,
        socket: null,
        nextCursor: null,
        loading: false,
        sending: false,
        messages: [], // oldest -> newest
        seenMessageIds: new Set(),
        pendingByTempId: new Map(),
        joinedCaseId: null,
        initialLoading: true,
        loadError: null,
      };

      if (chatSub && !chatSub.textContent.trim()) chatSub.textContent = `Case #${caseId}`;

      function setBanner(message) {
        if (!errorBanner) return;
        if (!message) {
          errorBanner.style.display = "none";
          errorBanner.textContent = "";
          return;
        }
        errorBanner.style.display = "block";
        errorBanner.textContent = message;
        if (window.toast) toast.error(message);
      }

      function textNode(str = "") {
        const span = document.createElement("span");
        span.textContent = str ?? "";
        return span;
      }

      function formatTime(iso) {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }

      function systemRoleLabel(msg = {}) {
        const messageType = String(msg.messageType || "").toUpperCase();
        if (["AI_SUMMARY", "AI_GUIDANCE", "AI_SUPPORT"].includes(messageType)) return "AI";
        if (messageType === "DOCTOR_REVIEWED") return "Doctor";
        if (["DOCTOR_ASSIGNED", "DOCTOR_ASSIGNMENT_UNAVAILABLE", "IMAGE_REUPLOAD"].includes(messageType)) return "System";
        return "System";
      }

      function isHiddenMessage(msg = {}) {
        const messageType = String(msg.messageType || "").toUpperCase();
        return ["AI_SUMMARY", "AI_GUIDANCE"].includes(messageType);
      }

      function visibleMessages() {
        return state.messages.filter((msg) => !isHiddenMessage(msg));
      }

      function createMessageContentNode(msg = {}) {
        const content = document.createElement("div");
        content.className = "msg__content bubble";

        const text = String(msg.content || "").trim();
        const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        const bulletLines = lines.filter((line) => /^[-*]\s+/.test(line));

        if (bulletLines.length >= 2 && bulletLines.length === lines.length) {
          const list = document.createElement("ul");
          list.className = "msg__list";
          bulletLines.forEach((line) => {
            const item = document.createElement("li");
            item.textContent = line.replace(/^[-*]\s+/, "");
            list.appendChild(item);
          });
          content.appendChild(list);
          return content;
        }

        content.textContent = text;
        return content;
      }

      function isNearBottom() {
        const threshold = 60;
        return messagesEl.scrollTop + messagesEl.clientHeight >= messagesEl.scrollHeight - threshold;
      }

      function scrollToBottom() {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }

      function normalizeJwt(raw) {
        if (!raw) return "";
        return raw.startsWith("Bearer ") ? raw.slice(7) : raw;
      }

      function upsertMessage(msg) {
        const mid = msg.id !== undefined ? Number(msg.id) : msg.id;
        if (mid && state.seenMessageIds.has(mid)) return;

        const byId = mid ? state.messages.findIndex((m) => Number(m.id) === mid) : -1;
        const byTemp = msg.tempId ? state.messages.findIndex((m) => m.tempId === msg.tempId) : -1;

        const idx = byId !== -1 ? byId : byTemp;
        if (idx !== -1) {
          state.messages[idx] = { ...state.messages[idx], ...msg, id: mid ?? msg.id };
        } else {
          state.messages.push({ ...msg, id: mid ?? msg.id });
        }
        if (mid) state.seenMessageIds.add(mid);
        if (msg.tempId && mid) state.pendingByTempId.delete(msg.tempId);

        state.messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      }

      function buildStateNotice({ title, description, className = "" }) {
        const empty = document.createElement("div");
        empty.className = `chat-empty-state ${className}`.trim();
        empty.innerHTML = `
          <strong>${title}</strong>
          <span>${description}</span>
        `;
        return empty;
      }

      function renderMessages() {
        if (!messagesEl) return;
        const stick = isNearBottom();
        messagesEl.innerHTML = "";

        if (state.initialLoading) {
          messagesEl.appendChild(
            buildStateNotice({
              title: "Loading chat...",
              description: "Preparing the latest messages and support state for this case.",
              className: "chat-empty-state--loading",
            })
          );
          return;
        }

        const visible = visibleMessages();

        if (!visible.length) {
          messagesEl.appendChild(
            buildStateNotice({
              title: "AI Support Active",
              description:
                state.loadError || "Ask a follow-up question, upload a better image, or request a doctor from the action bar below.",
            })
          );
          return;
        }

        const frag = document.createDocumentFragment();
        for (const msg of visible) {
          const isSelf = state.currentUser && Number(msg.senderId) === Number(state.currentUser.id);
          const isAiSupport = String(msg.messageType || "").toUpperCase() === "AI_SUPPORT";
          const isSystem =
            !isAiSupport && ((msg.senderRole || "").toUpperCase() === "SYSTEM" || msg.metaJson?.source === "ML_FUSION");
          const statusClass = msg.failed ? "msg--failed" : msg.pending ? "msg--pending" : "";
          const systemClass = isSystem ? "msg--system" : "";
          const aiClass = isAiSupport ? "msg--ai" : "";
          const el = document.createElement("div");
          el.className = `msg ${isSelf ? "msg--self" : "msg--other"} ${statusClass} ${systemClass} ${aiClass}`.trim();
          el.dataset.id = msg.id || "";
          el.dataset.tempId = msg.tempId || "";
          const content = createMessageContentNode(msg);

          const meta = document.createElement("div");
          meta.className = "msg__meta";
          const roleSpan = document.createElement("span");
          roleSpan.className = "msg__role";
          roleSpan.textContent = isAiSupport ? "AI" : isSystem ? systemRoleLabel(msg) : (msg.senderRole || "");
          if (isSystem || isAiSupport) roleSpan.classList.add("badge", "result");
          const timeSpan = document.createElement("span");
          timeSpan.className = "msg__time";
          timeSpan.textContent = `${formatTime(msg.createdAt)}${msg.pending ? " - Sending..." : ""}${msg.failed ? " - Failed" : ""}`;
          meta.append(roleSpan, timeSpan);

          el.append(content, meta);
          frag.appendChild(el);
        }
        messagesEl.appendChild(frag);

        if (stick) scrollToBottom();
      }

      function updateSendState() {
        const val = inputEl.value.trim();
        sendBtn.disabled = !val || state.sending;
      }

      function updateStatusDot() {
        const online = navigator.onLine && state.socket && state.socket.connected;
        const dotClass = online ? "online" : "offline";
        if (statusDot) statusDot.className = `dot ${dotClass}`;
        if (statusText) statusText.textContent = online ? "Online" : "Offline";
      }

      window.addEventListener("online", updateStatusDot);
      window.addEventListener("offline", updateStatusDot);

      async function fetchMe() {
        if (options.currentUser?.id) {
          state.currentUser = options.currentUser;
          return;
        }
        if (state.currentUser?.id) return;
        const res = await apiFetch("/users/me", { method: "GET" });
        state.currentUser = res?.data;
      }

      async function fetchMessages(cursor) {
        const qs = new URLSearchParams();
        qs.set("limit", "30");
        if (cursor) qs.set("cursor", String(cursor));

        const beforeHeight = messagesEl.scrollHeight;
        const beforeTop = messagesEl.scrollTop;

        const res = await apiFetch(`/cases/${caseId}/chat/messages?${qs.toString()}`, { method: "GET" });
        const items = res?.data?.items || [];
        state.nextCursor = res?.data?.nextCursor || null;
        for (const m of items) {
          const mid = m.id !== undefined ? Number(m.id) : m.id;
          if (mid && state.seenMessageIds.has(mid)) continue;
          if (mid) m.id = mid;
          upsertMessage(m);
        }
        renderMessages();

        if (cursor) {
          const afterHeight = messagesEl.scrollHeight;
          messagesEl.scrollTop = beforeTop + (afterHeight - beforeHeight);
        }
        state.loadError = null;
        setBanner(null);
        if (loadOlderBtn) loadOlderBtn.style.display = state.nextCursor ? "inline-flex" : "none";
        if (loadStateEl) loadStateEl.textContent = "";
      }

      async function reloadMessages() {
        const snapshot = {
          messages: [...state.messages],
          seenMessageIds: new Set(state.seenMessageIds),
          pendingByTempId: new Map(state.pendingByTempId),
          nextCursor: state.nextCursor,
        };

        if (loadStateEl) loadStateEl.textContent = "Refreshing...";
        try {
          state.messages = [];
          state.seenMessageIds = new Set();
          state.pendingByTempId = new Map();
          state.nextCursor = null;
          await fetchMessages();
        } catch (e) {
          state.messages = snapshot.messages;
          state.seenMessageIds = snapshot.seenMessageIds;
          state.pendingByTempId = snapshot.pendingByTempId;
          state.nextCursor = snapshot.nextCursor;
          state.loadError = e?.message || "Unable to refresh chat";
          setBanner(state.loadError);
          renderMessages();
        } finally {
        if (loadStateEl) loadStateEl.textContent = "";
        }
      }

      function appendExternalMessages(messages = []) {
        const list = Array.isArray(messages) ? messages : [messages];
        list.filter(Boolean).forEach((message) => upsertMessage({ ...message, pending: false, failed: false }));
        state.initialLoading = false;
        state.loadError = null;
        renderMessages();
      }

      function handleSocketEvents() {
        const s = state.socket;
        if (!s) return;

        s.on("connect", () => {
          updateStatusDot();
          if (state.joinedCaseId !== caseId) {
            s.emit("case:join", { caseId });
            state.joinedCaseId = caseId;
          } else {
            s.emit("case:join", { caseId });
          }
        });

        s.on("disconnect", () => {
          updateStatusDot();
        });

        s.io.on("reconnect_attempt", updateStatusDot);

        s.on("case:message:new", (msg) => {
          if (!msg) return;
          if (msg.id && state.seenMessageIds.has(msg.id)) return;
          if (msg.tempId && state.pendingByTempId.has(msg.tempId)) {
            const pendingMsg = state.pendingByTempId.get(msg.tempId);
            upsertMessage({ ...pendingMsg, ...msg, pending: false, failed: false });
          } else {
            upsertMessage({ ...msg, pending: false, failed: false });
          }
          renderMessages();
        });

        s.on("case:message:sent", (ack) => {
          if (!ack || !ack.tempId) return;
          const idx = state.messages.findIndex((m) => m.tempId === ack.tempId);
          if (idx !== -1) {
            state.messages[idx].id = ack.id;
            state.messages[idx].pending = false;
            state.messages[idx].failed = false;
            state.seenMessageIds.add(ack.id);
            state.pendingByTempId.delete(ack.tempId);
            renderMessages();
          }
        });

        s.on("case:error", (err) => {
          setBanner(err?.message || "Chat error");
          if (err?.tempId) {
            const idx = state.messages.findIndex((m) => m.tempId === err.tempId);
            if (idx !== -1) {
              state.messages[idx].pending = false;
              state.messages[idx].failed = true;
              renderMessages();
            }
          }
        });
      }

      function ensureSocket(caseIdForJoin, tokenForSocket) {
        const rawToken = normalizeJwt(options.token || getAccessToken());
        if (!rawToken) return;

        if (socketSingleton) {
          state.socket = socketSingleton;
          if (!socketSingleton.connected) socketSingleton.connect();
        } else {
          socketSingleton = io(window.EDGECARE_SOCKET_BASE || window.location.origin, {
            auth: { token: rawToken },
            extraHeaders: { Authorization: `Bearer ${rawToken}` },
            path: "/socket.io",
            transports: ["websocket"],
          });
          state.socket = socketSingleton;
          if (!listenersBound) {
            handleSocketEvents();
            listenersBound = true;
          }
          updateStatusDot();
        }

        // ensure join for this case
        if (state.socket && (state.joinedCaseId !== caseIdForJoin)) {
          state.socket.emit("case:join", { caseId: caseIdForJoin });
          state.joinedCaseId = caseIdForJoin;
        }
      }

      async function sendMessage(content) {
        const text = String(content || "").trim();
        if (!text) return;
        if (!navigator.onLine) {
          setBanner("You are offline");
          return;
        }

        const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const optimistic = {
          id: null,
          tempId,
          caseId,
          senderId: state.currentUser?.id,
          senderRole: state.currentUser?.role || "USER",
          content: text,
          type: "TEXT",
          createdAt: new Date().toISOString(),
          pending: true,
          failed: false,
        };
        upsertMessage(optimistic);
        if (tempId) state.pendingByTempId.set(tempId, optimistic);
        renderMessages();

        state.sending = true;
        updateSendState();

        try {
          const payload = { caseId, tempId, content: text, type: "TEXT" };
          let settled = false;

          state.socket
            ?.timeout(5000)
            .emit("case:message:send", payload, (err, ack) => {
              if (err) {
                if (state.pendingByTempId.has(tempId)) {
                  settled = true;
                  markFailed(tempId, err.message || "Send failed");
                }
                return;
              }
              if (ack && ack.success && ack.data?.id && state.pendingByTempId.has(tempId)) {
                upsertMessage({ ...ack.data, tempId, pending: false, failed: false });
                state.pendingByTempId.delete(tempId);
                settled = true;
                renderMessages();
              } else if (ack && ack.success === false && state.pendingByTempId.has(tempId)) {
                settled = true;
                markFailed(tempId, ack.message || "Send failed");
              }
            });

          const postRes = await apiFetch(`/cases/${caseId}/chat/messages`, {
            method: "POST",
            body: JSON.stringify({ content: text, type: "TEXT", tempId }),
          });

          if (postRes?.data?.id) {
            upsertMessage({ ...postRes.data, tempId, pending: false, failed: false });
            renderMessages();
          }

          // Patients can continue to use AI support from the chat even after doctor assignment.
          if (state.currentUser?.role === "PATIENT") {
            apiFetch(`/cases/${caseId}/chat/ai`, {
              method: "POST",
              body: JSON.stringify({ message: text }),
            })
              .then((aiRes) => {
                const payload = aiRes?.data;
                const messages = Array.isArray(payload) ? payload : payload ? [payload] : [];
                messages.forEach((m) => upsertMessage({ ...m, pending: false, failed: false }));
                if (messages.length) renderMessages();
              })
              .catch(() => {});
          }

          setBanner(null);

          if (!settled) {
            // waiting for socket broadcast/ack; keep pending state
          }
        } catch (e) {
          markFailed(tempId, e?.message || "Send failed");
        } finally {
          state.sending = false;
          updateSendState();
          inputEl.focus();
        }
      }

      function markFailed(tempId, message) {
        setBanner(message);
        const idx = state.messages.findIndex((m) => m.tempId === tempId);
        if (idx !== -1) {
          state.messages[idx].pending = false;
          state.messages[idx].failed = true;
          renderMessages();
        }
      }

      async function initInternal() {
        state.initialLoading = true;
        state.loadError = null;
        renderMessages();
        try {
          await fetchMe();
          if (!state.currentUser?.id) {
            state.loadError = "Unable to load current user";
            setBanner(state.loadError);
            return;
          }
          // reset per-case state
          state.messages = [];
          state.seenMessageIds.clear();
          state.pendingByTempId.clear();
          state.joinedCaseId = null;
          state.nextCursor = null;

          await fetchMessages();
          ensureSocket(caseId, options.token);
          updateSendState();
          updateStatusDot();
        } catch (e) {
          state.loadError = e?.message || "Unable to load chat";
          setBanner(state.loadError);
        } finally {
          state.initialLoading = false;
          renderMessages();
        }
      }

      sendBtn.addEventListener("click", () => {
        const text = inputEl.value;
        inputEl.value = "";
        updateSendState();
        sendMessage(text);
      });

      inputEl.addEventListener("input", updateSendState);
      inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (!sendBtn.disabled) sendBtn.click();
        }
      });

      loadOlderBtn?.addEventListener("click", async () => {
        if (!state.nextCursor || state.loading) return;
        state.loading = true;
        if (loadStateEl) loadStateEl.textContent = "Loading earlier messages...";
        try {
          await fetchMessages(state.nextCursor);
        } catch (e) {
          setBanner(e?.message || "Failed to load older messages");
        } finally {
          state.loading = false;
          if (loadStateEl) loadStateEl.textContent = "";
        }
      });

      this._api = {
        appendMessages: appendExternalMessages,
        reload: reloadMessages,
      };

      await initInternal();
      initInProgress = false;
    },
    appendMessages(messages = []) {
      this._api?.appendMessages?.(messages);
    },
    async reload() {
      return this._api?.reload?.();
    },
  };

      window.EdgeCareChat = EdgeCareChat;
})();
