package com.edgecare.core.remote

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST

interface EdgeCareApiService {

    @POST("api/v1/auth/register")
    suspend fun registerPatient(
        @Body body: RegisterRequest
    ): Response<ApiResponse<UserDto>>

    @POST("api/v1/auth/login")
    suspend fun loginPatient(
        @Body body: LoginRequest
    ): Response<ApiResponse<LoginResultDto>>

    @GET("api/v1/users/me")
    suspend fun getMe(): Response<ApiResponse<MeDto>>

    @GET("api/v1/patient/profile")
    suspend fun getPatientProfile(): Response<ApiResponse<PatientProfileResponseDto>>

    @PATCH("api/v1/patient/profile")
    suspend fun updatePatientProfile(
        @Body body: PatientProfileUpdateRequest
    ): Response<ApiResponse<PatientProfileResponseDto>>
}
