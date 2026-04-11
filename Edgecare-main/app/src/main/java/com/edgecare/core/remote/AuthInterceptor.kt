package com.edgecare.core.remote

import com.edgecare.core.session.AuthEvents
import com.edgecare.core.session.TokenProvider
import okhttp3.Interceptor
import okhttp3.Response

class AuthInterceptor(
    private val tokenProvider: TokenProvider
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()

        val token = tokenProvider.getAccessTokenBlocking()
        val reqBuilder = original.newBuilder()

        // Attach Authorization if token exists
        if (!token.isNullOrBlank()) {
            reqBuilder.header("Authorization", "Bearer $token")
        }

        val response = chain.proceed(reqBuilder.build())

        // Auto logout on 401
        if (response.code == 401) {
            tokenProvider.clearSessionBlocking()
            AuthEvents.triggerForceLogout()
        }

        return response
    }
}
