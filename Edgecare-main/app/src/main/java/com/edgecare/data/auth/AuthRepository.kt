package com.edgecare.data.auth

import com.edgecare.core.remote.EdgeCareApiService
import com.edgecare.core.remote.LoginRequest
import com.edgecare.core.remote.RegisterRequest

class AuthRepository(
    private val api: EdgeCareApiService
) {
    suspend fun register(req: RegisterRequest) = api.registerPatient(req)
    suspend fun login(req: LoginRequest) = api.loginPatient(req)
}
