package com.edgecare.ui.patient

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.edgecare.core.remote.ApiErrorParser
import com.edgecare.core.remote.PatientProfileResponseDto
import com.edgecare.core.remote.PatientProfileUpdateRequest
import com.edgecare.data.patient.PatientRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class PatientProfileUiState(
    val loading: Boolean = false,
    val profile: PatientProfileResponseDto? = null,
    val successMessage: String? = null,
    val errorMessage: String? = null
)

class PatientProfileViewModel(private val repository: PatientRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(PatientProfileUiState())
    val uiState: StateFlow<PatientProfileUiState> = _uiState

    fun loadProfile() {
        _uiState.value = _uiState.value.copy(loading = true)
        viewModelScope.launch {
            try {
                val response = repository.getProfile()
                if (response.isSuccessful && response.body()?.success == true) {
                    _uiState.value = _uiState.value.copy(
                        loading = false,
                        profile = response.body()?.data
                    )
                } else {
                    val errorMsg = ApiErrorParser.userMessage(response.errorBody()?.string())
                    _uiState.value = _uiState.value.copy(loading = false, errorMessage = errorMsg)
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(loading = false, errorMessage = e.message)
            }
        }
    }

    fun updateProfile(request: PatientProfileUpdateRequest) {
        _uiState.value = _uiState.value.copy(loading = true)
        viewModelScope.launch {
            try {
                val response = repository.updateProfile(request)
                if (response.isSuccessful && response.body()?.success == true) {
                    _uiState.value = _uiState.value.copy(
                        loading = false,
                        profile = response.body()?.data,
                        successMessage = "Profile updated"
                    )
                } else {
                    val errorMsg = ApiErrorParser.userMessage(response.errorBody()?.string())
                    _uiState.value = _uiState.value.copy(loading = false, errorMessage = errorMsg)
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(loading = false, errorMessage = e.message)
            }
        }
    }

    fun clearMessages() {
        _uiState.value = _uiState.value.copy(successMessage = null, errorMessage = null)
    }
}
