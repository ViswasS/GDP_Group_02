package com.edgecare.data.patient

import com.edgecare.core.remote.ApiResponse
import com.edgecare.core.remote.EdgeCareApiService
import com.edgecare.core.remote.PatientProfileResponseDto
import com.edgecare.core.remote.PatientProfileUpdateRequest
import retrofit2.Response

class PatientRepository(private val apiService: EdgeCareApiService) {

    suspend fun getProfile(): Response<ApiResponse<PatientProfileResponseDto>> {
        return apiService.getPatientProfile()
    }

    suspend fun updateProfile(request: PatientProfileUpdateRequest): Response<ApiResponse<PatientProfileResponseDto>> {
        return apiService.updatePatientProfile(request)
    }
}
