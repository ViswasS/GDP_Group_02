package com.edgecare.util

import com.edgecare.data.remote.dto.CaseDto
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

data class FinalAiAssessmentUi(
    val isCompleted: Boolean,
    val summary: String,
    val details: String,
    val nextStep: String
)

data class CaseOverviewUi(
    val title: String,
    val reference: String,
    val createdAt: String,
    val status: String,
    val assignedDoctor: String
)

data class EmergencyContactUi(
    val label: String,
    val number: String
)

data class EmergencySupportUi(
    val label: String,
    val heading: String,
    val guidance: String,
    val warning: String?,
    val contacts: List<EmergencyContactUi>
) {
    val contactsText: String
        get() = contacts.joinToString("\n") { "${it.label}: ${it.number}" }
}

data class DoctorReviewUi(
    val reviewer: String,
    val reviewedAt: String,
    val severity: String,
    val followUpNeeded: String,
    val notes: String?,
    val recommendation: String?,
    val isAvailable: Boolean
)

data class ReportDataUi(
    val body: String
)

data class EnvironmentContextUi(
    val summary: String,
    val guidance: String
)

data class CaseActionsUi(
    val canRequestDoctorReview: Boolean,
    val doctorReviewLabel: String,
    val canReuploadImage: Boolean,
    val reuploadLabel: String,
    val reuploadReason: String?
)

data class CaseAiUi(
    val overview: CaseOverviewUi,
    val finalAssessment: FinalAiAssessmentUi,
    val emergencySupport: EmergencySupportUi?,
    val doctorReview: DoctorReviewUi,
    val reportData: ReportDataUi,
    val environmentContext: EnvironmentContextUi?,
    val actions: CaseActionsUi
)

object CaseAiFormatter {
    private val dateFormatter: DateTimeFormatter =
        DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT)

    fun build(case: CaseDto): CaseAiUi {
        val assessment = resolveAssessment(case)
        val completed = case.mlStatus.equals("COMPLETED", ignoreCase = true) && assessment != null
        val triage = triageLabel(assessment)
        val severity = severityLabel(assessment)
        val condition = conditionLabel(assessment)
        val imageAssessment = imageAssessmentLabel(assessment)
        val quality = qualityLabel(case, assessment)
        val summary = summaryText(assessment, completed)
        val nextStep = nextStepText(assessment)

        val details = buildString {
            appendLine("Image review: $imageAssessment")
            appendLine("Possible condition: $condition")
            appendLine("Severity: $severity")
            append("Triage: $triage")
            if (!quality.isNullOrBlank()) {
                appendLine()
                append("Image quality: $quality")
            }
        }

        val finalAssessment = FinalAiAssessmentUi(
            isCompleted = completed,
            summary = summary,
            details = details,
            nextStep = nextStep
        )

        val doctorReview = buildDoctorReview(case)
        val emergency = buildEmergencySupport(assessment)
        val environmentContext = buildEnvironmentContext(case)
        val actions = buildActions(case, assessment)
        val overview = CaseOverviewUi(
            title = case.intake?.title ?: case.description ?: "Case overview",
            reference = "Case #${case.id}",
            createdAt = formatDate(case.submittedAt) ?: case.submittedAt,
            status = caseStatusText(case.status),
            assignedDoctor = doctorDisplay(case)
        )
        val reportData = ReportDataUi(
            body = buildString {
                appendLine("Reference: ${overview.reference}")
                appendLine("Created: ${overview.createdAt}")
                appendLine("Current status: ${overview.status}")
                appendLine("Assigned doctor: ${overview.assignedDoctor}")
                appendLine("Latest image evidence: ${latestImageLabel(case)}")
                environmentContext?.let {
                    appendLine("Environment: ${it.summary}")
                }
                append("Report source: Backend case data and backend image analysis")
            }
        )

        return CaseAiUi(
            overview = overview,
            finalAssessment = finalAssessment,
            emergencySupport = emergency,
            doctorReview = doctorReview,
            reportData = reportData,
            environmentContext = environmentContext,
            actions = actions
        )
    }

    private fun resolveAssessment(case: CaseDto): JsonObject? {
        val candidates = listOf(case.mlReport, case.mlFusedResult, case.mlImageResult)
            .mapNotNull { it.asJsonObjectOrNull() }
        candidates.forEach { candidate ->
            candidate.optObject("finalAssessment")?.let { return it }
            candidate.optObject("aiTriage")?.let { return it }
            if (looksLikeAssessment(candidate)) return candidate
        }
        return candidates.firstOrNull()
    }

    private fun looksLikeAssessment(value: JsonObject): Boolean {
        return listOf(
            "display",
            "recommended_actions",
            "ai_summary_text",
            "triage",
            "triage_level",
            "severity",
            "final_severity_level",
            "condition",
            "condition_text",
            "emergency_support"
        ).any(value::has)
    }

    private fun summaryText(assessment: JsonObject?, completed: Boolean): String {
        val display = assessment.optObject("display")
        return display.optString("summary_text")
            ?: assessment.optString("ai_summary_text", "summary", "guidance_text")
            ?: if (completed) {
                "Final AI assessment saved from backend image analysis."
            } else {
                "Final AI assessment is pending. Add a clear photo or wait for backend analysis to finish."
            }
    }

    private fun imageAssessmentLabel(assessment: JsonObject?): String {
        val display = assessment.optObject("display")
        return display.optString("image_assessment")
            ?: assessment.optString("image_assessment", "image_gate_status", "gate_result")
            ?: "Image review pending"
    }

    private fun conditionLabel(assessment: JsonObject?): String {
        val display = assessment.optObject("display")
        return display.optString("condition_text")
            ?: assessment.optString(
                "condition_text",
                "condition",
                "predicted_condition",
                "predicted_disease",
                "disease_prediction",
                "disease"
            )
            ?: "Condition unclear from image"
    }

    private fun severityLabel(assessment: JsonObject?): String {
        val display = assessment.optObject("display")
        return display.optString("severity_text")
            ?: assessment.optString("final_severity_level", "severity", "predicted_class")
            ?.let(::titleize)
            ?: "Pending"
    }

    private fun triageLabel(assessment: JsonObject?): String {
        val display = assessment.optObject("display")
        display.optString("triage_text")?.let { return it }

        val recommended = assessment.optObject("recommended_actions")
        return when (recommended.optString("care_level", fallback = null) ?: assessment.optString("triage_level", "triage")) {
            "urgent_attention" -> "Urgent attention"
            "priority_review" -> "Priority review"
            "routine_review" -> "Routine review"
            "home_care", "home_monitoring", "self_care" -> "Home care / monitor"
            null -> "Pending"
            else -> titleize(recommended.optString("care_level", fallback = null) ?: assessment.optString("triage_level", "triage") ?: "Pending")
        }
    }

    private fun nextStepText(assessment: JsonObject?): String {
        val display = assessment.optObject("display")
        display.optString("next_step_text")?.let { return it }

        val recommended = assessment.optObject("recommended_actions")
        recommended.optStringArray("items").firstOrNull()?.let { return it }

        return assessment.optString("recommended_action", "recommendation", "guidance_text")
            ?: "Follow the final AI assessment and request doctor review if symptoms worsen."
    }

    private fun qualityLabel(case: CaseDto, assessment: JsonObject?): String? {
        val imageGate = assessment.optObject("image_gate")
        val quality = imageGate.optObject("quality")
        return quality.optString("quality_status")
            ?: assessment.optString("quality_status")
            ?: case.mlImageResult.asJsonObjectOrNull().optString("quality")
            ?.let(::titleize)
    }

    private fun buildEmergencySupport(assessment: JsonObject?): EmergencySupportUi? {
        val display = assessment.optObject("display")
        val emergency = display.optObject("emergency_support")
        val recommended = assessment.optObject("recommended_actions")
        val careLevel = (recommended.optString("care_level", fallback = null)
            ?: assessment.optString("triage_level", "triage"))
            ?.lowercase(Locale.US)

        val isEmergency = emergency.optBoolean("is_emergency") == true ||
            display.optBoolean("show_urgent_badge") == true ||
            careLevel == "urgent_attention"

        if (!isEmergency) return null

        val contactsText = emergency.optContacts()
            .ifEmpty {
                listOf(
                    EmergencyContactUi(label = "Emergency", number = "112"),
                    EmergencyContactUi(label = "Ambulance", number = "108")
                )
            }

        return EmergencySupportUi(
            label = emergency.optString("label") ?: "Urgent care recommended",
            heading = emergency.optString("heading") ?: "Seek immediate medical attention",
            guidance = emergency.optString("guidance_text")
                ?: assessment.optString("guidance_text")
                ?: "This case may need urgent medical evaluation. If symptoms are severe or worsening, call emergency services or go to the nearest hospital now.",
            warning = emergency.optString("warning_text")
                ?: recommended.optString("urgent_warning")
                ?: assessment.optString("urgent_warning"),
            contacts = contactsText
        )
    }

    private fun buildDoctorReview(case: CaseDto): DoctorReviewUi {
        val recommendation = case.doctorRecommendation ?: case.result?.recommendation
        val reviewedAt = case.doctorReviewedAt ?: case.result?.generatedAt
        val available = recommendation != null ||
            case.doctorNotes != null ||
            case.doctorSeverityOverride != null ||
            case.doctorFollowUpNeeded != null

        return DoctorReviewUi(
            reviewer = doctorDisplay(case),
            reviewedAt = formatDate(reviewedAt) ?: "Pending",
            severity = case.doctorSeverityOverride?.let(::titleize) ?: "Not specified",
            followUpNeeded = when (case.doctorFollowUpNeeded) {
                true -> "Yes"
                false -> "No"
                null -> "Not specified"
            },
            notes = case.doctorNotes,
            recommendation = recommendation,
            isAvailable = available
        )
    }

    private fun buildEnvironmentContext(case: CaseDto): EnvironmentContextUi? {
        val symptomsObject = if (case.symptoms?.isJsonObject == true) case.symptoms.asJsonObject else null
        val context = symptomsObject.optObject("environmentContext") ?: return null
        val climate = context.optString("climate")?.let(::titleize)
        val exposures = context.optStringArray("exposures").map(::titleize)
        if (climate.isNullOrBlank() && exposures.isEmpty()) return null

        val summary = buildString {
            if (!climate.isNullOrBlank()) {
                append("Climate: $climate")
            }
            if (exposures.isNotEmpty()) {
                if (isNotBlank()) append(" | ")
                append("Possible triggers: ${exposures.joinToString(", ")}")
            }
        }

        val guidance = when (context.optString("climate")) {
            "HOT_HUMID" -> "Heat, sweat, and friction can add useful context, but they do not confirm the diagnosis on their own."
            "DRY_LOW_HUMIDITY" -> "Dry conditions can help explain irritation patterns, but final assessment still comes from the case review."
            "DUSTY_POLLUTION" -> "Dust and pollution can matter when contact irritation is suspected."
            "RAINY_DAMP" -> "Persistent dampness can matter when moisture or friction may be worsening the rash."
            "CHANGED_ENVIRONMENT" -> "Recent travel or a new environment can help explain timing and exposure changes."
            else -> "Environmental context helps explain possible triggers, but it does not replace the final case assessment."
        }

        return EnvironmentContextUi(summary = summary, guidance = guidance)
    }

    private fun buildActions(case: CaseDto, assessment: JsonObject?): CaseActionsUi {
        val display = assessment.optObject("display")
        val actionCtas = display.optObject("action_ctas")
        val canRequestDoctor = actionCtas.optBoolean("request_doctor")
            ?: (case.assignedDoctorId == null && !case.status.equals("CLOSED", ignoreCase = true))
        val canReupload = actionCtas.optBoolean("reupload_image")
            ?: shouldSuggestReupload(case, assessment)

        val doctorLabel = when {
            case.assignedDoctorId != null -> "Doctor assigned"
            case.status.equals("IN_REVIEW", ignoreCase = true) -> "Review requested"
            else -> "Request doctor review"
        }

        return CaseActionsUi(
            canRequestDoctorReview = canRequestDoctor && case.assignedDoctorId == null,
            doctorReviewLabel = doctorLabel,
            canReuploadImage = canReupload,
            reuploadLabel = if (canReupload) "Re-upload image" else "Image clear enough",
            reuploadReason = if (canReupload) deriveReuploadReason(case, assessment) else null
        )
    }

    private fun shouldSuggestReupload(case: CaseDto, assessment: JsonObject?): Boolean {
        val quality = qualityLabel(case, assessment)?.lowercase(Locale.US).orEmpty()
        if (quality.contains("poor") || quality.contains("blurry") || quality.contains("unclear")) {
            return true
        }

        val combinedText = listOfNotNull(
            summaryText(assessment, completed = case.mlStatus.equals("COMPLETED", ignoreCase = true)),
            imageAssessmentLabel(assessment),
            conditionLabel(assessment),
            assessment.optString("guidance_text"),
            assessment.optObject("display").optString("condition_text")
        ).joinToString(" ").lowercase(Locale.US)

        return listOf(
            "unclear",
            "uncertain",
            "non-skin",
            "non skin",
            "no obvious rash",
            "no rash",
            "better image",
            "re-upload",
            "reupload",
            "poor quality",
            "blurry",
            "out of focus"
        ).any(combinedText::contains)
    }

    private fun deriveReuploadReason(case: CaseDto, assessment: JsonObject?): String {
        val quality = qualityLabel(case, assessment)
        val condition = conditionLabel(assessment)
        return when {
            !quality.isNullOrBlank() -> "Backend review marked this image as $quality. A clearer close-up can improve the final assessment."
            condition.contains("unclear", ignoreCase = true) -> "Backend review could not clearly identify the skin concern from this image."
            condition.contains("non", ignoreCase = true) && condition.contains("skin", ignoreCase = true) ->
                "Backend review suggests the image may not clearly show skin findings."
            else -> "Backend review suggests a new image could improve confidence."
        }
    }

    private fun latestImageLabel(case: CaseDto): String {
        val latest = case.images
            ?.maxByOrNull { it.uploadedAt }
            ?.uploadedAt
            ?.let(::formatDate)
        return latest ?: if (!case.imageUrls.isNullOrEmpty()) "Image on file" else "No image on file"
    }

    private fun doctorDisplay(case: CaseDto): String {
        val doctor = case.assignedDoctor ?: return "No doctor assigned yet"
        val fullName = listOfNotNull(doctor.firstName, doctor.lastName)
            .joinToString(" ")
            .trim()
        return if (fullName.isNotBlank()) "Dr. $fullName" else "Assigned doctor"
    }

    private fun caseStatusText(status: String?): String {
        return when (status?.uppercase(Locale.US)) {
            "SUBMITTED" -> "AI Support Active"
            "IN_REVIEW" -> "In Review"
            "CLOSED" -> "Closed"
            else -> titleize(status ?: "Unknown")
        }
    }

    private fun titleize(value: String): String {
        return value
            .replace("_", " ")
            .replace("-", " ")
            .trim()
            .lowercase(Locale.US)
            .split(" ")
            .filter { it.isNotBlank() }
            .joinToString(" ") { token ->
                token.replaceFirstChar { char ->
                    if (char.isLowerCase()) char.titlecase(Locale.US) else char.toString()
                }
            }
    }

    private fun formatDate(raw: String?): String? {
        if (raw.isNullOrBlank()) return null
        return try {
            OffsetDateTime.parse(raw).format(dateFormatter)
        } catch (_: Exception) {
            raw
        }
    }

    private fun JsonObject?.optObject(key: String): JsonObject? {
        if (this == null || !has(key)) return null
        val value = get(key)
        return if (value != null && value.isJsonObject) value.asJsonObject else null
    }

    private fun JsonObject?.optString(vararg keys: String, fallback: String? = null): String? {
        if (this == null) return fallback
        keys.forEach { key ->
            if (!has(key)) return@forEach
            val value = get(key)
            val text = value.safeStringDeep()?.trim()
            if (!text.isNullOrBlank()) {
                return text
            }
        }
        return fallback
    }

    private fun JsonObject?.optBoolean(key: String): Boolean? {
        if (this == null || !has(key)) return null
        val value = get(key)
        if (value == null || value.isJsonNull || !value.isJsonPrimitive) return null
        val primitive = value.asJsonPrimitive
        return when {
            primitive.isBoolean -> primitive.asBoolean
            primitive.isString -> primitive.asString.toBooleanStrictOrNull()
            primitive.isNumber -> primitive.asInt != 0
            else -> null
        }
    }

    private fun JsonObject?.optStringArray(key: String): List<String> {
        if (this == null || !has(key)) return emptyList()
        val value = get(key)
        if (value == null || !value.isJsonArray) return emptyList()
        return value.asJsonArray
            .mapNotNull { element -> element.safeStringDeep() }
    }

    private fun JsonObject?.optContacts(): List<EmergencyContactUi> {
        if (this == null || !has("contacts")) return emptyList()
        val contacts = get("contacts")
        if (contacts == null || !contacts.isJsonArray) return emptyList()
        return contacts.asJsonArray.mapNotNull { item ->
            if (!item.isJsonObject) return@mapNotNull null
            val obj = item.asJsonObject
            val label = obj.optString("label") ?: return@mapNotNull null
            val number = obj.optString("number") ?: return@mapNotNull null
            EmergencyContactUi(label = label, number = number)
        }
    }

    private fun JsonElement?.safeStringDeep(maxDepth: Int = 3): String? {
        if (this == null || isJsonNull || maxDepth < 0) return null

        return when {
            isJsonPrimitive -> runCatching { asString }.getOrNull()
            isJsonArray -> asJsonArray
                .mapNotNull { it.safeStringDeep(maxDepth - 1) }
                .firstOrNull()
            isJsonObject -> {
                val preferredKeys = listOf(
                    "label",
                    "text",
                    "value",
                    "name",
                    "title",
                    "summary",
                    "message",
                    "status",
                    "level",
                    "severity",
                    "condition",
                    "guidance",
                    "recommendation",
                    "care_level",
                    "triage_text",
                    "severity_text",
                    "condition_text",
                    "image_assessment",
                    "quality_status",
                    "next_step_text"
                )
                preferredKeys.asSequence()
                    .mapNotNull { key ->
                        if (asJsonObject.has(key)) asJsonObject.get(key).safeStringDeep(maxDepth - 1) else null
                    }
                    .firstOrNull()
                    ?: asJsonObject.entrySet().asSequence()
                        .mapNotNull { (_, value) -> value.safeStringDeep(maxDepth - 1) }
                        .firstOrNull()
            }
            else -> null
        }?.takeIf { it.isNotBlank() }
    }

    private fun JsonElement?.asJsonObjectOrNull(): JsonObject? {
        if (this == null || isJsonNull || !isJsonObject) return null
        return asJsonObject
    }
}
