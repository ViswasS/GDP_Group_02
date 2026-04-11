package com.edgecare.ui.cases

data class QuestionnaireOption(
    val value: String,
    val label: String
)

data class QuestionnaireState(
    val selectedSymptoms: List<String>,
    val spreadingStatus: String?,
    val durationDays: Int?,
    val durationLabel: String?,
    val isEmergency: Boolean,
    val environmentClimate: String?,
    val environmentalExposures: List<String>
)

enum class QuestionnaireFieldType {
    BOOLEAN,
    CHOICE
}

data class FollowUpField(
    val key: String,
    val label: String,
    val type: QuestionnaireFieldType,
    val options: List<String> = emptyList(),
    val trueLabel: String = "Yes",
    val falseLabel: String = "No"
)

data class FollowUpGroup(
    val id: String,
    val title: String,
    val note: String,
    val alert: String? = null,
    val fields: List<FollowUpField>,
    val shouldShow: (QuestionnaireState) -> Boolean
)

data class EnvironmentGuidance(
    val eyebrow: String,
    val body: String
)

object CaseQuestionnaire {
    private val longStandingLabels = setOf("2 weeks", "1 month", "2+ months")

    val environmentOptions = listOf(
        QuestionnaireOption("HOT_HUMID", "Hot / humid"),
        QuestionnaireOption("DRY_LOW_HUMIDITY", "Dry / low-humidity"),
        QuestionnaireOption("DUSTY_POLLUTION", "Dusty / pollution-heavy"),
        QuestionnaireOption("RAINY_DAMP", "Rainy / damp"),
        QuestionnaireOption("CHANGED_ENVIRONMENT", "Recently changed environment / traveled")
    )

    val exposureOptions = listOf(
        QuestionnaireOption("SWEATING_HEAT", "Sweating / heat exposure"),
        QuestionnaireOption("NEW_SKINCARE", "New skincare / cosmetic product"),
        QuestionnaireOption("OUTDOOR_SUN", "Outdoor exposure / sun"),
        QuestionnaireOption("DUST_POLLUTION", "Dust / pollution exposure"),
        QuestionnaireOption("SEASONAL_ALLERGY", "Seasonal allergy period")
    )

    private val followUpGroups = listOf(
        FollowUpGroup(
            id = "itching",
            title = "Itching follow-up",
            note = "Because itching is part of this case, a couple of extra details help improve the intake summary.",
            fields = listOf(
                FollowUpField(
                    key = "severity",
                    label = "How intense is the itching?",
                    type = QuestionnaireFieldType.CHOICE,
                    options = listOf("Mild", "Moderate", "Severe")
                ),
                FollowUpField(
                    key = "worseAtNight",
                    label = "Is the itching worse at night?",
                    type = QuestionnaireFieldType.BOOLEAN
                )
            )
        ) { state ->
            state.selectedSymptoms.contains("Itching")
        },
        FollowUpGroup(
            id = "pain",
            title = "Pain or tenderness follow-up",
            note = "Because pain or burning is present, this helps capture whether the area feels inflamed or tender.",
            fields = listOf(
                FollowUpField(
                    key = "warm",
                    label = "Does the area feel warm?",
                    type = QuestionnaireFieldType.BOOLEAN
                ),
                FollowUpField(
                    key = "swollen",
                    label = "Does the area look or feel swollen?",
                    type = QuestionnaireFieldType.BOOLEAN
                ),
                FollowUpField(
                    key = "painfulToTouch",
                    label = "Is it painful to touch?",
                    type = QuestionnaireFieldType.BOOLEAN
                )
            )
        ) { state ->
            state.selectedSymptoms.contains("Pain") || state.selectedSymptoms.contains("Burning")
        },
        FollowUpGroup(
            id = "spreading",
            title = "Spreading follow-up",
            note = "Because the area may be spreading, this helps identify whether it is changing quickly.",
            fields = listOf(
                FollowUpField(
                    key = "spreadQuickly",
                    label = "Has it spread quickly in the last 24 to 72 hours?",
                    type = QuestionnaireFieldType.BOOLEAN
                )
            )
        ) { state ->
            state.spreadingStatus == "SPREADING"
        },
        FollowUpGroup(
            id = "history",
            title = "History follow-up",
            note = "Because this has been going on for longer, it helps to know whether it has happened before.",
            fields = listOf(
                FollowUpField(
                    key = "happenedBefore",
                    label = "Has this happened before?",
                    type = QuestionnaireFieldType.BOOLEAN
                )
            )
        ) { state ->
            isLongStandingDuration(state)
        },
        FollowUpGroup(
            id = "urgent",
            title = "Urgent symptom follow-up",
            note = "These extra answers help the system prioritize urgent support safely.",
            alert = "If you have trouble breathing, rapid swelling of the face or lips, or severe worsening symptoms, seek emergency help immediately.",
            fields = listOf(
                FollowUpField(
                    key = "feverPresent",
                    label = "Is fever currently present?",
                    type = QuestionnaireFieldType.BOOLEAN
                ),
                FollowUpField(
                    key = "breathingOrFaceSwelling",
                    label = "Any breathing difficulty or fast swelling of the face, lips, or eyes?",
                    type = QuestionnaireFieldType.BOOLEAN
                )
            )
        ) { state ->
            state.isEmergency ||
                state.selectedSymptoms.contains("Fever/Chills") ||
                state.selectedSymptoms.contains("Swelling")
        },
        FollowUpGroup(
            id = "environmentHotHumid",
            title = "Heat and humidity follow-up",
            note = "Because a hot or humid environment was selected, this checks whether sweat or friction seems to make the area worse.",
            fields = listOf(
                FollowUpField(
                    key = "worseWithSweatOrFriction",
                    label = "Does it seem worse after sweating, heat, or skin friction?",
                    type = QuestionnaireFieldType.BOOLEAN
                )
            )
        ) { state ->
            state.environmentClimate == "HOT_HUMID" || state.environmentalExposures.contains("SWEATING_HEAT")
        },
        FollowUpGroup(
            id = "environmentDry",
            title = "Dry climate follow-up",
            note = "Because dry conditions were selected, this captures whether the skin feels tight, cracked, or more irritated than usual.",
            fields = listOf(
                FollowUpField(
                    key = "drynessOrCracking",
                    label = "Does the area feel unusually dry, tight, or cracked?",
                    type = QuestionnaireFieldType.BOOLEAN
                )
            )
        ) { state ->
            state.environmentClimate == "DRY_LOW_HUMIDITY"
        },
        FollowUpGroup(
            id = "environmentDust",
            title = "Dust or pollution follow-up",
            note = "Because dust or pollution exposure was selected, this helps capture whether symptoms seem linked to outdoor or contact exposure.",
            fields = listOf(
                FollowUpField(
                    key = "worseAfterDustOrOutdoorExposure",
                    label = "Does it feel worse after outdoor activity, dust, or pollution exposure?",
                    type = QuestionnaireFieldType.BOOLEAN
                )
            )
        ) { state ->
            state.environmentClimate == "DUSTY_POLLUTION" || state.environmentalExposures.contains("DUST_POLLUTION")
        },
        FollowUpGroup(
            id = "environmentDamp",
            title = "Rainy or damp follow-up",
            note = "Because damp conditions were selected, this checks whether moisture or staying in wet clothing seems to worsen the area.",
            fields = listOf(
                FollowUpField(
                    key = "worseWhenDamp",
                    label = "Does it seem worse after rain, sweat, or staying damp for a while?",
                    type = QuestionnaireFieldType.BOOLEAN
                )
            )
        ) { state ->
            state.environmentClimate == "RAINY_DAMP"
        },
        FollowUpGroup(
            id = "environmentChange",
            title = "Recent change follow-up",
            note = "Because recent travel or an environmental change was selected, this checks whether the timing matches a new place, routine, or product.",
            fields = listOf(
                FollowUpField(
                    key = "startedAfterTravelOrChange",
                    label = "Did this start after travel, a new stay, or a recent change in routine or products?",
                    type = QuestionnaireFieldType.BOOLEAN
                )
            )
        ) { state ->
            state.environmentClimate == "CHANGED_ENVIRONMENT"
        }
    )

    fun deriveVisibleFollowUpGroups(state: QuestionnaireState): List<FollowUpGroup> {
        return followUpGroups.filter { it.shouldShow(state) }
    }

    fun deriveEnvironmentGuidance(state: QuestionnaireState): EnvironmentGuidance? {
        val climate = state.environmentClimate
        val exposures = state.environmentalExposures
        if (climate.isNullOrBlank() && exposures.isEmpty()) return null

        return when {
            climate == "HOT_HUMID" -> EnvironmentGuidance(
                eyebrow = "Heat / humidity context",
                body = "Warm, humid environments can make sweat, friction, and moisture-related irritation more relevant. A couple of extra questions will focus on whether heat or dampness seems to worsen the area."
            )
            climate == "DRY_LOW_HUMIDITY" -> EnvironmentGuidance(
                eyebrow = "Dryness context",
                body = "Dry air can make cracking, tightness, and irritation more relevant. Extra prompts will focus on dryness-related discomfort rather than diagnosis."
            )
            climate == "DUSTY_POLLUTION" || exposures.contains("DUST_POLLUTION") -> EnvironmentGuidance(
                eyebrow = "Irritation / exposure context",
                body = "Dust and pollution exposure can help explain when irritation or contact triggers seem worse. The questionnaire will ask one short follow-up about outdoor or dust-linked worsening."
            )
            climate == "RAINY_DAMP" -> EnvironmentGuidance(
                eyebrow = "Dampness context",
                body = "Damp or rainy conditions can make moisture and occlusion more relevant. A short follow-up will ask whether the area worsens after sweating, rain, or staying damp."
            )
            climate == "CHANGED_ENVIRONMENT" -> EnvironmentGuidance(
                eyebrow = "Recent change context",
                body = "A recent trip or environmental change can be useful intake context. A short follow-up will ask whether symptoms started after travel or a change in routine or products."
            )
            exposures.contains("NEW_SKINCARE") ||
                exposures.contains("OUTDOOR_SUN") ||
                exposures.contains("SEASONAL_ALLERGY") -> EnvironmentGuidance(
                eyebrow = "Possible trigger context",
                body = "These exposure details are saved as context for AI support and doctor review. They are helpful background, not a diagnosis on their own."
            )
            else -> null
        }
    }

    private fun isLongStandingDuration(state: QuestionnaireState): Boolean {
        if ((state.durationDays ?: 0) >= 14) return true
        return longStandingLabels.contains((state.durationLabel ?: "").lowercase())
    }
}
