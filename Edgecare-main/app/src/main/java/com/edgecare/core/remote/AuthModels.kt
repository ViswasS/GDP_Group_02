package com.edgecare.core.remote

// ---------- Requests ----------
data class RegisterRequest(
    val email: String,
    val password: String,
    val role: String = "PATIENT",
    val profile: PatientProfile = PatientProfile()
)

data class PatientProfile(
    val firstName: String? = null,
    val lastName: String? = null,
    val dob: String? = null,
    val gender: String? = null,
    val language: String = "en",
    val consentStatus: Boolean = true
)

data class LoginRequest(
    val email: String,
    val password: String,
    val role: String = "PATIENT"
)

data class PatientProfileUpdateRequest(
    val firstName: String? = null,
    val lastName: String? = null,
    val dob: String? = null,
    val gender: String? = null,
    val language: String? = null,
    val consentStatus: Boolean? = null
)

// ---------- Controller wrapper ----------
data class ApiResponse<T>(
    val success: Boolean,
    val data: T?,
    val message: String?
)

// ---------- Responses ----------
data class UserDto(
    val id: Long? = null,
    val email: String? = null,
    val role: String? = null
)

data class LoginResultDto(
    val accessToken: String? = null,
    val refreshToken: String? = null,
    val user: UserDto? = null
)

data class MeDto(
    val id: String? = null,
    val email: String? = null,
    val displayName: String? = null,
    val patientProfile: PatientProfileDto? = null
)

data class PatientProfileDto(
    val firstName: String? = null,
    val lastName: String? = null,
    val dob: String? = null,
    val gender: String? = null
)

data class PatientProfileResponseDto(
    val patientId: String? = null,
    val firstName: String? = null,
    val lastName: String? = null,
    val dob: String? = null,
    val gender: String? = null,
    val language: String? = null,
    val consentStatus: Boolean? = null,
    val user: UserDto? = null
)
