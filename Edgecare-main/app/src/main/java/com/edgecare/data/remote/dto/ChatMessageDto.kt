package com.edgecare.data.remote.dto

import com.google.gson.JsonElement
import com.google.gson.annotations.SerializedName

data class ChatMessageDto(
    @SerializedName("id") val id: Long? = null,
    @SerializedName("conversationId") val conversationId: Long? = null,
    @SerializedName("senderId") val senderId: Long? = null,
    @SerializedName("senderRole") val senderRole: String = "",
    @SerializedName("content") val content: String,
    @SerializedName("type") val type: String = "text",
    @SerializedName("createdAt") val createdAt: String? = null,
    @SerializedName("caseId") val caseId: Long,
    @SerializedName("tempId") val tempId: String? = null,
    @SerializedName("messageType") val messageType: String? = null,
    @SerializedName("metaJson") val metaJson: JsonElement? = null,
    val pending: Boolean = false,
    val failed: Boolean = false
)

data class ChatHistoryResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: ChatHistoryData
)

data class ChatHistoryData(
    @SerializedName("items") val items: List<ChatMessageDto>,
    @SerializedName("nextCursor") val nextCursor: Long?
)

data class SendChatMessageRequest(
    val content: String,
    val type: String = "TEXT",
    val tempId: String? = null
)

data class TriggerAiReplyRequest(
    val message: String
)
