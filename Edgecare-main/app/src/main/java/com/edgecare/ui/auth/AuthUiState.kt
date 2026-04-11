package com.edgecare.ui.auth

data class AuthUiState(
    val loading: Boolean = false,
    val successMessage: String? = null,
    val errorMessage: String? = null
)
