package com.edgecare.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.edgecare.core.remote.ApiErrorParser
import com.edgecare.core.remote.LoginRequest
import com.edgecare.core.remote.PatientProfile
import com.edgecare.core.remote.RegisterRequest
import com.edgecare.core.session.SessionStore
import com.edgecare.data.auth.AuthRepository
import com.edgecare.data.user.UserRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class AuthViewModel(
    private val authRepository: AuthRepository,
    private val userRepository: UserRepository,
    private val sessionStore: SessionStore
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState

    fun register(email: String, password: String, firstName: String, lastName: String, dob: String?, gender: String?) {
        _uiState.value = AuthUiState(loading = true)

        viewModelScope.launch {
            try {
                val response = authRepository.register(
                    RegisterRequest(
                        email = email,
                        password = password,
                        role = "PATIENT",
                        profile = PatientProfile(
                            firstName = firstName,
                            lastName = lastName,
                            dob = dob,
                            gender = gender,
                            language = "en",
                            consentStatus = true
                        )
                    )
                )

                if (response.isSuccessful && response.body()?.success == true) {
                    _uiState.value = AuthUiState(
                        successMessage = response.body()?.message ?: "Registered successfully"
                    )
                } else {
                    val errorBodyString = response.errorBody()?.string()
                    _uiState.value = AuthUiState(
                        errorMessage = response.body()?.message
                            ?: ApiErrorParser.userMessage(errorBodyString, "Registration failed")
                    )
                }

            } catch (e: Exception) {
                _uiState.value = AuthUiState(
                    errorMessage = "Network error: ${e.message}"
                )
            }
        }
    }

    fun login(email: String, password: String) {
        _uiState.value = AuthUiState(loading = true)

        viewModelScope.launch {
            try {
                val response = authRepository.login(
                    LoginRequest(
                        email = email,
                        password = password,
                        role = "PATIENT"
                    )
                )

                if (response.isSuccessful && response.body()?.success == true) {
                    val loginData = response.body()?.data

                    // 1. Save core session tokens
                    sessionStore.saveSession(
                        accessToken = loginData?.accessToken,
                        refreshToken = loginData?.refreshToken,
                        email = loginData?.user?.email
                    )

                    // 1b. Persist user id for chat feature routing
                    sessionStore.saveUserId(loginData?.user?.id)

                    // 2. Fetch User Info (Me)
                    fetchMeAndCompleteLogin(response.body()?.message ?: "Logged in")
                } else {
                    val errorBodyString = response.errorBody()?.string()
                    _uiState.value = AuthUiState(
                        errorMessage = response.body()?.message
                            ?: ApiErrorParser.userMessage(errorBodyString, "Login failed")
                    )
                }

            } catch (e: Exception) {
                _uiState.value = AuthUiState(
                    errorMessage = "Network error: ${e.message}"
                )
            }
        }
    }

    private suspend fun fetchMeAndCompleteLogin(loginSuccessMessage: String) {
        try {
            val meResponse = userRepository.getMe()
            if (meResponse.isSuccessful && meResponse.body()?.success == true) {
                val meData = meResponse.body()?.data
                val displayName = meData?.displayName ?: "${meData?.patientProfile?.firstName ?: ""} ${meData?.patientProfile?.lastName ?: ""}".trim()
                
                sessionStore.saveDisplayName(if (displayName.isNotEmpty()) displayName else null)
                val parsedId = meData?.id?.toLongOrNull()
                if (parsedId != null) {
                    sessionStore.saveUserId(parsedId)
                }

                _uiState.value = AuthUiState(
                    successMessage = loginSuccessMessage
                )
            } else {
                // Even if getMe fails, we have the tokens, but for consistency we show login success
                _uiState.value = AuthUiState(successMessage = loginSuccessMessage)
            }
        } catch (e: Exception) {
            // Network error fetching profile, but we are technically logged in
            _uiState.value = AuthUiState(successMessage = loginSuccessMessage)
        }
    }

    fun clearMessages() {
        _uiState.value = _uiState.value.copy(
            successMessage = null,
            errorMessage = null
        )
    }
}
