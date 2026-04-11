package com.edgecare.data.remote.api

import com.edgecare.core.remote.ApiResponse
import com.edgecare.data.remote.dto.CaseDto
import com.edgecare.data.remote.dto.ChatHistoryResponse
import com.edgecare.data.remote.dto.CreateCaseRequest
import com.edgecare.data.remote.dto.SaveImagesRequest
import com.edgecare.data.remote.dto.SaveMlRequest
import com.edgecare.data.remote.dto.SendChatMessageRequest
import com.edgecare.data.remote.dto.TriggerAiReplyRequest
import com.edgecare.data.remote.dto.ChatMessageDto
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface CasesApi {

    @POST("api/v1/cases")
    suspend fun createCase(
        @Body request: CreateCaseRequest
    ): Response<ApiResponse<CaseDto>>

    @GET("api/v1/cases")
    suspend fun getCases(): Response<ApiResponse<List<CaseDto>>>

    @GET("api/v1/cases/{id}")
    suspend fun getCaseDetails(
        @Path("id") id: Int
    ): Response<ApiResponse<CaseDto>>

    @POST("api/v1/cases/{id}/images")
    suspend fun saveImages(
        @Path("id") id: Int,
        @Body body: SaveImagesRequest
    ): Response<ApiResponse<Unit>>

    @POST("api/v1/cases/{id}/ml")
    suspend fun saveMlResults(
        @Path("id") id: Int,
        @Body body: SaveMlRequest
    ): Response<ApiResponse<Unit>>

    @GET("api/v1/cases/{caseId}/chat/messages")
    suspend fun getChatMessages(
        @Path("caseId") caseId: Long,
        @Query("cursor") cursor: Long? = null,
        @Query("limit") limit: Int = 30
    ): Response<ChatHistoryResponse>

    @POST("api/v1/cases/{id}/request-doctor")
    suspend fun requestDoctorReview(
        @Path("id") id: Int,
        @Body body: JsonObject = JsonObject()
    ): Response<ApiResponse<JsonObject>>

    @POST("api/v1/cases/{id}/reupload-image")
    suspend fun reuploadImage(
        @Path("id") id: Int,
        @Body body: SaveImagesRequest
    ): Response<ApiResponse<JsonObject>>

    @POST("api/v1/cases/{caseId}/chat/messages")
    suspend fun sendChatMessage(
        @Path("caseId") caseId: Long,
        @Body body: SendChatMessageRequest
    ): Response<ApiResponse<ChatMessageDto>>

    @POST("api/v1/cases/{caseId}/chat/ai")
    suspend fun triggerAiReply(
        @Path("caseId") caseId: Long,
        @Body body: TriggerAiReplyRequest
    ): Response<ApiResponse<JsonElement>>
}
