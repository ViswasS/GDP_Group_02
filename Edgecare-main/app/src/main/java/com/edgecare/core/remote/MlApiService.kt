package com.edgecare.core.remote

import com.google.gson.JsonElement
import okhttp3.MultipartBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Body
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part

data class AnalyzeSymptomsRequest(
    val itching: Int,
    val fever: Boolean,
    val pain_level: Int,
    val duration_days: Int
)

data class FuseResultsRequest(
    val image_severity_score: Double,
    val symptom_risk_score: Double
)

interface MlApiService {
    @GET("ml/health")
    suspend fun health(): Response<ResponseBody>

    @Multipart
    @POST("ml/analyze-image")
    suspend fun analyzeImage(
        @Part file: MultipartBody.Part
    ): Response<ResponseBody>

    @POST("ml/analyze-symptoms")
    suspend fun analyzeSymptoms(
        @Body body: AnalyzeSymptomsRequest
    ): Response<ResponseBody>

    @POST("ml/fuse-results")
    suspend fun fuseResults(
        @Body body: FuseResultsRequest
    ): Response<ResponseBody>
}
