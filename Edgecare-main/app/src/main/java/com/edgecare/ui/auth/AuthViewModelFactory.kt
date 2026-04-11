package com.edgecare.ui.auth

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.edgecare.core.remote.EdgeCareApiClient
import com.edgecare.core.remote.EdgeCareApiService
import com.edgecare.core.session.DataStoreTokenProvider
import com.edgecare.core.session.SessionStore
import com.edgecare.data.auth.AuthRepository
import com.edgecare.data.user.UserRepository

class AuthViewModelFactory(
    private val context: Context
) : ViewModelProvider.Factory {

    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {

        val sessionStore = SessionStore(context)
        val tokenProvider = DataStoreTokenProvider(sessionStore)

        val retrofit = EdgeCareApiClient.create(tokenProvider)
        val apiService = retrofit.create(EdgeCareApiService::class.java)

        val authRepository = AuthRepository(apiService)
        val userRepository = UserRepository(apiService)

        return AuthViewModel(authRepository, userRepository, sessionStore) as T
    }
}
