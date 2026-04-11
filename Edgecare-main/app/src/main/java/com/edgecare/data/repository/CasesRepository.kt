package com.edgecare.data.repository

import com.edgecare.core.remote.ApiErrorParser
import com.edgecare.data.remote.api.CasesApi
import com.edgecare.data.remote.dto.CaseDto
import com.edgecare.data.remote.dto.ChatHistoryData
import com.edgecare.data.remote.dto.ChatMessageDto
import com.edgecare.data.remote.dto.CreateCaseRequest
import com.edgecare.data.remote.dto.SaveImagesRequest
import com.edgecare.data.remote.dto.SaveMlRequest
import com.edgecare.data.remote.dto.SendChatMessageRequest
import com.edgecare.data.remote.dto.TriggerAiReplyRequest
import com.edgecare.util.CaseAiFormatter
import com.google.gson.Gson
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import org.json.JSONObject
import java.time.Instant
import java.time.OffsetDateTime
import java.time.format.DateTimeParseException
import java.util.Locale

data class ApiActionResult(
    val data: JsonObject?,
    val message: String?
)

data class AiSupportPlan(
    val shouldTrigger: Boolean,
    val prompt: String? = null,
    val pendingMessage: String? = null,
    val reason: String? = null
)

class CasesRepository(private val api: CasesApi) {
    private val gson = Gson()

    suspend fun fetchCases(): Result<List<CaseDto>> {
        return try {
            val response = api.getCases()
            if (response.isSuccessful) {
                Result.success(response.body()?.data ?: emptyList())
            } else {
                Result.failure(Exception(ApiErrorParser.userMessage(response.errorBody()?.string())))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun fetchCaseDetails(id: Int): Result<CaseDto> {
        return try {
            val response = api.getCaseDetails(id)
            if (response.isSuccessful) {
                response.body()?.data?.let {
                    Result.success(it)
                } ?: Result.failure(Exception("Case not found"))
            } else {
                Result.failure(Exception(ApiErrorParser.userMessage(response.errorBody()?.string())))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createCase(request: CreateCaseRequest): Result<CaseDto> {
        return try {
            val response = api.createCase(request)
            if (response.isSuccessful) {
                response.body()?.data?.let {
                    Result.success(it)
                } ?: Result.failure(Exception("Failed to create case"))
            } else {
                val errorBody = response.errorBody()?.string()
                val message = parseValidationError(errorBody)
                Result.failure(Exception(message))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun saveImages(id: Int, request: SaveImagesRequest): Result<Unit> {
        return try {
            val response = api.saveImages(id, request)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(ApiErrorParser.userMessage(response.errorBody()?.string())))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun saveMlResults(id: Int, request: SaveMlRequest): Result<Unit> {
        return try {
            val response = api.saveMlResults(id, request)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(ApiErrorParser.userMessage(response.errorBody()?.string())))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun fetchChatHistory(caseId: Long, cursor: Long? = null, limit: Int = 30): Result<ChatHistoryData> {
        return try {
            val response = api.getChatMessages(caseId, cursor = cursor, limit = limit)
            if (response.isSuccessful) {
                response.body()?.data?.let(Result.Companion::success)
                    ?: Result.failure(Exception("Chat history is unavailable"))
            } else {
                Result.failure(Exception(ApiErrorParser.userMessage(response.errorBody()?.string())))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun triggerAiSupport(caseId: Long, prompt: String): Result<List<ChatMessageDto>> {
        return try {
            val response = api.triggerAiReply(caseId, TriggerAiReplyRequest(message = prompt))
            if (response.isSuccessful) {
                val messages = parseAiMessages(response.body()?.data, caseId)
                if (messages.isNotEmpty()) {
                    rememberAutoTrigger(caseId)
                    Result.success(messages)
                } else {
                    Result.failure(Exception("AI support returned no message"))
                }
            } else {
                Result.failure(Exception(ApiErrorParser.userMessage(response.errorBody()?.string())))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun sendChatMessage(caseId: Long, request: SendChatMessageRequest): Result<ChatMessageDto> {
        return try {
            val response = api.sendChatMessage(caseId, request)
            if (response.isSuccessful) {
                response.body()?.data?.let(Result.Companion::success)
                    ?: Result.failure(Exception("Message send failed"))
            } else {
                Result.failure(Exception(ApiErrorParser.userMessage(response.errorBody()?.string())))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun buildAutoAiSupportPlan(
        caseId: Long,
        caseData: CaseDto? = null,
        existingMessages: List<ChatMessageDto>? = null
    ): Result<AiSupportPlan> {
        return try {
            if (isWithinTriggerCooldown(caseId)) {
                return Result.success(AiSupportPlan(shouldTrigger = false, reason = "cooldown"))
            }

            val resolvedCase = caseData ?: fetchCaseDetails(caseId.toInt()).getOrThrow()
            val history = existingMessages ?: fetchChatHistory(caseId).getOrThrow().items

            if (hasRecentAiSupportMessage(resolvedCase, history)) {
                Result.success(AiSupportPlan(shouldTrigger = false, reason = "recent_ai_message"))
            } else {
                Result.success(createSupportPlan(resolvedCase))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun requestDoctorReview(id: Int): Result<ApiActionResult> {
        return try {
            val response = api.requestDoctorReview(id)
            if (response.isSuccessful) {
                Result.success(ApiActionResult(response.body()?.data, response.body()?.message))
            } else {
                Result.failure(Exception(ApiErrorParser.userMessage(response.errorBody()?.string())))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun reuploadImage(id: Int, request: SaveImagesRequest): Result<ApiActionResult> {
        return try {
            val response = api.reuploadImage(id, request)
            if (response.isSuccessful) {
                Result.success(ApiActionResult(response.body()?.data, response.body()?.message))
            } else {
                Result.failure(Exception(ApiErrorParser.userMessage(response.errorBody()?.string())))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun parseValidationError(errorBody: String?): String {
        if (errorBody == null) return "Unknown error"
        return try {
            val json = JSONObject(errorBody)
            val message = json.optString("message", "Validation error")
            val details = json.optJSONObject("details")
            val fieldErrors = details?.optJSONObject("fieldErrors")?.optJSONObject("body")
            
            if (fieldErrors != null) {
                val sb = StringBuilder()
                val keys = fieldErrors.keys()
                while (keys.hasNext()) {
                    val key = keys.next()
                    val errors = fieldErrors.getJSONArray(key)
                    if (errors.length() > 0) {
                        sb.append("$key: ${errors.getString(0)}\n")
                    }
                }
                sb.toString().trim()
            } else {
                message
            }
        } catch (e: Exception) {
            ApiErrorParser.userMessage(errorBody)
        }
    }

    private fun createSupportPlan(case: CaseDto): AiSupportPlan {
        val aiUi = CaseAiFormatter.build(case)
        val combinedAssessmentText = listOf(
            aiUi.finalAssessment.summary,
            aiUi.finalAssessment.details,
            aiUi.finalAssessment.nextStep,
            aiUi.actions.reuploadReason.orEmpty()
        ).joinToString(" ").lowercase(Locale.US)

        return when {
            aiUi.emergencySupport != null -> AiSupportPlan(
                shouldTrigger = true,
                reason = "urgent",
                pendingMessage = "AI Support is preparing urgent guidance for this case...",
                prompt = buildString {
                    append("Create a single AI_SUPPORT message for this patient case. ")
                    append("The backend final assessment indicates urgent attention. ")
                    append("Clearly tell the patient to seek emergency care now, repeat the immediate emergency guidance, and recommend doctor review. ")
                    append("Assessment summary: ${aiUi.finalAssessment.summary}. ")
                    append("Next step: ${aiUi.finalAssessment.nextStep}.")
                }
            )
            combinedAssessmentText.contains("non-rash") ||
                combinedAssessmentText.contains("non rash") ||
                combinedAssessmentText.contains("non-skin") ||
                combinedAssessmentText.contains("non skin") ||
                combinedAssessmentText.contains("no obvious rash") ||
                aiUi.actions.canReuploadImage -> AiSupportPlan(
                shouldTrigger = true,
                reason = "reupload",
                pendingMessage = "AI Support is reviewing whether a clearer image is needed...",
                prompt = buildString {
                    append("Create a single AI_SUPPORT message for this patient case. ")
                    append("The backend image assessment suggests the image may not clearly show a rash or may need re-upload. ")
                    append("Ask the patient to upload a clearer close-up image, explain why that helps, and suggest doctor review if the concern continues. ")
                    append("Assessment summary: ${aiUi.finalAssessment.summary}. ")
                    aiUi.actions.reuploadReason?.let { append("Re-upload reason: $it. ") }
                    append("Next step: ${aiUi.finalAssessment.nextStep}.")
                }
            )
            combinedAssessmentText.contains("unclear") ||
                combinedAssessmentText.contains("uncertain") ||
                combinedAssessmentText.contains("pending") -> AiSupportPlan(
                shouldTrigger = true,
                reason = "uncertain",
                pendingMessage = "AI Support is preparing a careful next-step summary...",
                prompt = buildString {
                    append("Create a single AI_SUPPORT message for this patient case. ")
                    append("The backend assessment is uncertain or incomplete. ")
                    append("Conservatively explain that the patient should consider doctor review, continue safe monitoring, and upload a clearer image if needed. ")
                    append("Assessment summary: ${aiUi.finalAssessment.summary}. ")
                    append("Next step: ${aiUi.finalAssessment.nextStep}.")
                }
            )
            case.mlStatus.equals("COMPLETED", ignoreCase = true) -> AiSupportPlan(
                shouldTrigger = true,
                reason = "assessment_ready",
                pendingMessage = "AI Support is preparing your case summary...",
                prompt = buildString {
                    append("Create a single AI_SUPPORT message for this patient case. ")
                    append("Use the backend final assessment as the source of truth. ")
                    append("Summarize the likely concern, triage level, and next step in patient-friendly language. ")
                    append("Assessment summary: ${aiUi.finalAssessment.summary}. ")
                    append("Details: ${aiUi.finalAssessment.details}. ")
                    append("Next step: ${aiUi.finalAssessment.nextStep}.")
                }
            )
            else -> AiSupportPlan(
                shouldTrigger = true,
                reason = "initial_support",
                pendingMessage = "AI Support is preparing the first case message...",
                prompt = buildString {
                    append("Create a single AI_SUPPORT message for a newly opened patient case. ")
                    append("Explain that AI support is active, final backend assessment may still be pending, and the patient can upload a clear image or ask follow-up questions. ")
                    append("Current case status: ${case.status}. ")
                    append("ML status: ${case.mlStatus ?: "PENDING"}.")
                }
            )
        }
    }

    private fun hasRecentAiSupportMessage(case: CaseDto, messages: List<ChatMessageDto>): Boolean {
        val latestAiMessage = messages
            .filter(::isAiSupportMessage)
            .mapNotNull { parseInstant(it.createdAt) }
            .maxOrNull()
            ?: return false

        val latestCaseEvent = listOfNotNull(
            parseInstant(case.submittedAt),
            case.images.orEmpty().mapNotNull { parseInstant(it.uploadedAt) }.maxOrNull()
        ).maxOrNull() ?: return false

        return !latestAiMessage.isBefore(latestCaseEvent)
    }

    private fun isAiSupportMessage(message: ChatMessageDto): Boolean {
        val type = message.messageType.orEmpty().uppercase(Locale.US)
        return message.senderRole.equals("AI", ignoreCase = true) ||
            type in setOf("AI_SUPPORT", "AI_SUMMARY", "AI_GUIDANCE")
    }

    private fun parseAiMessages(payload: JsonElement?, caseId: Long): List<ChatMessageDto> {
        if (payload == null || payload.isJsonNull) return emptyList()

        return when {
            payload.isJsonArray -> payload.asJsonArray.mapNotNull { parseChatMessage(it, caseId) }
            payload.isJsonObject -> parseMessagesFromObject(payload.asJsonObject, caseId)
            else -> emptyList()
        }
    }

    private fun parseMessagesFromObject(payload: JsonObject, caseId: Long): List<ChatMessageDto> {
        payload.get("items")?.takeIf { it.isJsonArray }?.let { array ->
            return array.asJsonArray.mapNotNull { parseChatMessage(it, caseId) }
        }
        payload.get("messages")?.takeIf { it.isJsonArray }?.let { array ->
            return array.asJsonArray.mapNotNull { parseChatMessage(it, caseId) }
        }
        payload.get("systemMessage")?.let { nested ->
            return listOfNotNull(parseChatMessage(nested, caseId))
        }
        if (payload.has("content")) {
            return listOfNotNull(parseChatMessage(payload, caseId))
        }
        payload.get("reply")?.let { reply ->
            val text = runCatching { reply.asString }.getOrNull()?.trim().orEmpty()
            if (text.isNotBlank()) {
                return listOf(
                    ChatMessageDto(
                        senderRole = "AI",
                        content = text,
                        caseId = caseId,
                        createdAt = Instant.now().toString(),
                        messageType = "AI_SUPPORT"
                    )
                )
            }
        }
        return emptyList()
    }

    private fun parseChatMessage(payload: JsonElement, caseId: Long): ChatMessageDto? {
        return try {
            val parsed = gson.fromJson(payload, ChatMessageDto::class.java)
            if (parsed.caseId == 0L) parsed.copy(caseId = caseId) else parsed
        } catch (_: Exception) {
            null
        }
    }

    private fun parseInstant(raw: String?): Instant? {
        if (raw.isNullOrBlank()) return null
        return try {
            Instant.parse(raw)
        } catch (_: DateTimeParseException) {
            try {
                OffsetDateTime.parse(raw).toInstant()
            } catch (_: Exception) {
                null
            }
        }
    }

    private fun isWithinTriggerCooldown(caseId: Long): Boolean {
        val lastTrigger = lastAutoTriggerByCase[caseId] ?: return false
        return (System.currentTimeMillis() - lastTrigger) < AUTO_TRIGGER_COOLDOWN_MS
    }

    private fun rememberAutoTrigger(caseId: Long) {
        lastAutoTriggerByCase[caseId] = System.currentTimeMillis()
    }

    companion object {
        private const val AUTO_TRIGGER_COOLDOWN_MS = 45_000L
        private val lastAutoTriggerByCase = mutableMapOf<Long, Long>()
    }
}
