package com.edgecare.data.user

import com.edgecare.core.remote.ApiResponse
import com.edgecare.core.remote.EdgeCareApiService
import com.edgecare.core.remote.MeDto
import retrofit2.Response

class UserRepository(private val api: EdgeCareApiService) {
    suspend fun getMe(): Response<ApiResponse<MeDto>> {
        return api.getMe()
    }
}
