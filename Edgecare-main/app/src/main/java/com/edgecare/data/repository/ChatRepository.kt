package com.edgecare.data.repository

import android.util.Log
import com.edgecare.data.remote.dto.ChatMessageDto
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.util.UUID

class ChatRepository(
    private val casesRepository: CasesRepository,
    private val scope: CoroutineScope
) {
    private val logTag = "ChatRepository"

    private val _messages = MutableStateFlow<List<ChatMessageDto>>(emptyList())
    val messages = _messages.asStateFlow()

    private val _isSending = MutableStateFlow(false)
    val isSending = _isSending.asStateFlow()

    private val _isLoadingHistory = MutableStateFlow(false)
    val isLoadingHistory = _isLoadingHistory.asStateFlow()

    private val _isAwaitingAiReply = MutableStateFlow(false)
    val isAwaitingAiReply = _isAwaitingAiReply.asStateFlow()

    private val _hasMoreHistory = MutableStateFlow(false)
    val hasMoreHistory = _hasMoreHistory.asStateFlow()

    private val _errors = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val errors = _errors.asSharedFlow()

    private val perCaseCache = mutableMapOf<Long, MutableList<ChatMessageDto>>()
    private val nextCursorByCase = mutableMapOf<Long, Long?>()
    private var activeCaseId: Long? = null
    private var activeUserId: Long? = null

    fun setActiveCase(caseId: Long) {
        activeCaseId = caseId
        _messages.value = perCaseCache[caseId]
            ?.sortedBy { it.createdAt ?: "" }
            ?: emptyList()
        _hasMoreHistory.value = nextCursorByCase[caseId] != null
        _isAwaitingAiReply.value = false
    }

    suspend fun loadInitial(caseId: Long) {
        activeCaseId = caseId
        _isLoadingHistory.value = true
        try {
            val history = casesRepository.fetchChatHistory(caseId).getOrThrow()
            val items = history?.items.orEmpty().map(::normalizeMessage)
            nextCursorByCase[caseId] = history?.nextCursor
            _hasMoreHistory.value = history?.nextCursor != null
            perCaseCache[caseId] = items.sortedBy { it.createdAt ?: "" }.toMutableList()

            if (activeCaseId == caseId) {
                _messages.value = perCaseCache[caseId].orEmpty()
            }

            ensureSupportMessageIfNeeded(caseId)
        } catch (e: Exception) {
            _errors.tryEmit(e.message ?: "Unable to load chat history")
            logError("load_initial_failed", mapOf("error" to (e.message ?: "unknown"), "caseId" to caseId))
        } finally {
            _isLoadingHistory.value = false
        }
    }

    suspend fun loadOlderMessages() {
        val caseId = activeCaseId ?: return
        val cursor = nextCursorByCase[caseId] ?: return

        _isLoadingHistory.value = true
        try {
            val history = casesRepository.fetchChatHistory(caseId, cursor = cursor).getOrThrow()
            nextCursorByCase[caseId] = history?.nextCursor
            _hasMoreHistory.value = history?.nextCursor != null

            val existing = perCaseCache[caseId].orEmpty()
            val merged = (history?.items.orEmpty().map(::normalizeMessage) + existing)
                .distinctBy { it.id ?: it.tempId ?: "${it.createdAt}-${it.content}" }
                .sortedBy { it.createdAt ?: "" }
                .toMutableList()

            perCaseCache[caseId] = merged
            if (activeCaseId == caseId) {
                _messages.value = merged
            }
        } catch (e: Exception) {
            _errors.tryEmit(e.message ?: "Unable to load older messages")
            logError("load_older_failed", mapOf("error" to (e.message ?: "unknown"), "caseId" to caseId))
        } finally {
            _isLoadingHistory.value = false
        }
    }

    fun sendMessage(caseId: Long, content: String, senderId: Long) {
        if (content.isBlank()) return

        activeCaseId = caseId
        activeUserId = senderId

        val tempId = UUID.randomUUID().toString()
        val optimistic = ChatMessageDto(
            senderId = senderId,
            senderRole = "PATIENT",
            content = content,
            caseId = caseId,
            tempId = tempId,
            createdAt = Instant.now().toString(),
            pending = true
        )
        upsertMessage(caseId, optimistic)
        _isSending.value = true

        scope.launch {
            try {
                val savedMessage = casesRepository.sendChatMessage(
                    caseId = caseId,
                    request = com.edgecare.data.remote.dto.SendChatMessageRequest(
                        content = content,
                        tempId = tempId
                    )
                ).getOrThrow().let(::normalizeMessage)
                upsertMessage(
                    caseId,
                    savedMessage.copy(tempId = tempId, pending = false, failed = false)
                )

                runAiReply(caseId, content)
            } catch (e: Exception) {
                markMessageFailed(caseId, tempId)
                _errors.tryEmit(e.message ?: "Unable to send message")
                logError("send_message_failed", mapOf("error" to (e.message ?: "unknown"), "caseId" to caseId))
            } finally {
                _isSending.value = false
            }
        }
    }

    private suspend fun runAiReply(caseId: Long, content: String) {
        val placeholderId = showPendingAiPlaceholder(
            caseId = caseId,
            message = "AI Support is reviewing your latest message..."
        )
        _isAwaitingAiReply.value = true
        try {
            casesRepository.triggerAiSupport(caseId, content)
                .getOrThrow()
                .forEach { upsertMessage(caseId, normalizeMessage(it)) }
        } catch (e: Exception) {
            _errors.tryEmit(e.message ?: "AI reply is unavailable right now")
            logError("ai_reply_failed", mapOf("error" to (e.message ?: "unknown"), "caseId" to caseId))
        } finally {
            removePendingAiPlaceholder(caseId, placeholderId)
            _isAwaitingAiReply.value = false
        }
    }

    private fun normalizeMessage(message: ChatMessageDto): ChatMessageDto {
        return message.copy(
            senderRole = message.senderRole.ifBlank {
                when (message.messageType?.uppercase()) {
                    "AI_SUPPORT", "AI_SUMMARY", "AI_GUIDANCE" -> "AI"
                    else -> "SYSTEM"
                }
            },
            pending = false,
            failed = false
        )
    }

    private suspend fun ensureSupportMessageIfNeeded(caseId: Long) {
        var placeholderId: String? = null
        try {
            val existing = perCaseCache[caseId].orEmpty()
            val plan = casesRepository.buildAutoAiSupportPlan(caseId, existingMessages = existing).getOrThrow()
            if (!plan.shouldTrigger || plan.prompt.isNullOrBlank()) {
                return
            }

            placeholderId = showPendingAiPlaceholder(
                caseId = caseId,
                message = plan.pendingMessage ?: "AI Support is preparing the latest guidance..."
            )
            _isAwaitingAiReply.value = true

            val aiMessages = casesRepository.triggerAiSupport(caseId, plan.prompt).getOrThrow()
            aiMessages.forEach { upsertMessage(caseId, normalizeMessage(it)) }
        } catch (e: Exception) {
            _errors.tryEmit(e.message ?: "AI support is unavailable right now")
            logError("ensure_support_failed", mapOf("error" to (e.message ?: "unknown"), "caseId" to caseId))
        } finally {
            placeholderId?.let { removePendingAiPlaceholder(caseId, it) }
            _isAwaitingAiReply.value = false
        }
    }

    private fun showPendingAiPlaceholder(caseId: Long, message: String): String {
        val tempId = "pending-ai-${UUID.randomUUID()}"
        upsertMessage(
            caseId,
            ChatMessageDto(
                senderRole = "AI",
                content = message,
                caseId = caseId,
                createdAt = Instant.now().toString(),
                tempId = tempId,
                messageType = "AI_SUPPORT",
                pending = true
            )
        )
        return tempId
    }

    private fun removePendingAiPlaceholder(caseId: Long, tempId: String) {
        val updated = perCaseCache[caseId].orEmpty()
            .filterNot { it.tempId == tempId }
            .toMutableList()
        perCaseCache[caseId] = updated
        if (activeCaseId == caseId) {
            _messages.value = updated
        }
    }

    private fun upsertMessage(caseId: Long, message: ChatMessageDto) {
        val existing = perCaseCache[caseId].orEmpty().toMutableList()
        val index = existing.indexOfFirst { current ->
            (message.id != null && current.id == message.id) ||
                (message.tempId != null && current.tempId == message.tempId)
        }

        if (index >= 0) {
            existing[index] = existing[index].copy(
                id = message.id ?: existing[index].id,
                conversationId = message.conversationId ?: existing[index].conversationId,
                senderId = message.senderId ?: existing[index].senderId,
                senderRole = message.senderRole.ifBlank { existing[index].senderRole },
                content = message.content,
                type = message.type,
                createdAt = message.createdAt ?: existing[index].createdAt,
                caseId = message.caseId,
                tempId = message.tempId ?: existing[index].tempId,
                messageType = message.messageType ?: existing[index].messageType,
                metaJson = message.metaJson ?: existing[index].metaJson,
                pending = message.pending,
                failed = message.failed
            )
        } else {
            existing.add(message)
        }

        val sorted = existing.sortedBy { it.createdAt ?: "" }.toMutableList()
        perCaseCache[caseId] = sorted
        if (activeCaseId == caseId) {
            _messages.value = sorted
        }
    }

    private fun markMessageFailed(caseId: Long, tempId: String) {
        val updated = perCaseCache[caseId].orEmpty().map { message ->
            if (message.tempId == tempId) message.copy(pending = false, failed = true) else message
        }.toMutableList()

        perCaseCache[caseId] = updated
        if (activeCaseId == caseId) {
            _messages.value = updated
        }
    }

    private fun logError(event: String, extras: Map<String, Any?> = emptyMap()) {
        val timestamp = System.currentTimeMillis()
        val base = mutableListOf(
            "ts=$timestamp",
            "thread=${Thread.currentThread().name}",
            "caseId=${activeCaseId ?: "-"}",
            "userId=${activeUserId ?: "-"}"
        )
        extras.forEach { (key, value) -> base.add("$key=${value ?: "-"}") }
        Log.e(logTag, "[${base.joinToString(",")}] event=$event")
    }
}
