package com.edgecare.data.remote.dto

import com.edgecare.core.remote.ApiResponse
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.annotations.SerializedName

data class CaseDto(
    val id: Int,
    val patientId: Int,
    val intakeId: Int,
    val isEmergency: Boolean,
    val assignedDoctorId: Int?,
    val status: String,
    val submittedAt: String,
    val intake: IntakeDto?,
    val result: TriageResultDto? = null,
    val patient: PatientDto? = null,
    val assignedDoctor: DoctorDto? = null,
    val images: List<CaseImageDto>? = null,
    val reviews: List<CaseReviewDto>? = null,
    @SerializedName(value = "imageUrls", alternate = ["image_urls"])
    val imageUrls: List<String>? = null,
    val symptoms: JsonElement? = null,
    val description: String? = null,
    val rashLocation: String? = null,
    val durationLabel: String? = null,
    val severity: Int? = null,
    val itchiness: Int? = null,
    val spreadingStatus: String? = null,
    val triggers: String? = null,
    @SerializedName(value = "mlStatus", alternate = ["ml_status"])
    val mlStatus: String? = null,
    @SerializedName(value = "mlImageResult", alternate = ["ml_image_result"])
    val mlImageResult: JsonElement? = null,
    @SerializedName(value = "mlSymptomsResult", alternate = ["ml_symptoms_result"])
    val mlSymptomsResult: JsonElement? = null,
    @SerializedName(value = "mlFusedResult", alternate = ["ml_fused_result"])
    val mlFusedResult: JsonElement? = null,
    @SerializedName(value = "mlReport", alternate = ["ml_report"])
    val mlReport: JsonElement? = null,
    @SerializedName(value = "mlDebug", alternate = ["ml_debug"])
    val mlDebug: JsonElement? = null,
    @SerializedName(value = "mlLastError", alternate = ["ml_last_error"])
    val mlLastError: String? = null,
    @SerializedName(value = "doctorReviewedAt", alternate = ["doctor_reviewed_at"])
    val doctorReviewedAt: String? = null,
    @SerializedName(value = "doctorNotes", alternate = ["doctor_notes"])
    val doctorNotes: String? = null,
    @SerializedName(value = "doctorRecommendation", alternate = ["doctor_recommendation"])
    val doctorRecommendation: String? = null,
    @SerializedName(value = "doctorSeverityOverride", alternate = ["doctor_severity_override"])
    val doctorSeverityOverride: String? = null,
    @SerializedName(value = "doctorFollowUpNeeded", alternate = ["doctor_follow_up_needed"])
    val doctorFollowUpNeeded: Boolean? = null
)

data class IntakeDto(
    val id: Int,
    val title: String,
    val isActive: Boolean,
    val duration: String?,
    val medications: String?
)

data class TriageResultDto(
    val id: Int,
    val caseId: Int,
    val recommendation: String,
    val confidenceScore: String?, // Decimal serialized as string
    val generatedAt: String,
    val modelId: Int?
)

data class CreateCaseRequest(
    val title: String,
    val duration: String? = null,
    val durationDays: Int? = null,
    val durationLabel: String? = null,
    val medications: String? = null,
    val isEmergency: Boolean = false,
    val description: String? = null,
    val rashLocation: String? = null,
    val symptoms: JsonElement? = null,
    val severity: Int? = null,
    val itchiness: Int? = null,
    val spreadingStatus: String? = null,
    val triggers: String? = null,
    val imageUrls: List<String>? = null,
    val mlImageResult: JsonElement? = null,
    val mlSymptomsResult: JsonElement? = null,
    val mlFusedResult: JsonElement? = null,
    val mlReport: JsonElement? = null
)

data class SaveImagesRequest(
    val imageUrls: List<String>
)

data class SaveMlRequest(
    val mlImageResult: JsonElement? = null,
    val mlSymptomsResult: JsonElement? = null,
    val mlFusedResult: JsonElement? = null,
    val mlReport: JsonElement? = null,
    val mlDebug: JsonElement? = null,
    val mlLastError: String? = null,
    val mlStatus: String? = null
)

data class PatientDto(
    val patientId: Int,
    val firstName: String? = null,
    val lastName: String? = null
)

data class DoctorDto(
    val firstName: String?,
    val lastName: String?
)

data class CaseImageDto(
    val id: Int,
    val caseId: Int,
    val imageUrl: String?,
    val uploadedAt: String
)

data class CaseReviewDto(
    val id: Int,
    val caseId: Int,
    val doctorId: Int,
    val actionNotes: String?,
    val reviewTimestamp: String
)
