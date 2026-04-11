package com.edgecare.ui.cases

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.TypedValue
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.navArgs
import com.edgecare.R
import com.edgecare.core.remote.EdgeCareApiClient
import com.edgecare.core.session.DataStoreTokenProvider
import com.edgecare.core.session.SessionStore
import com.edgecare.data.remote.api.CasesApi
import com.edgecare.data.remote.dto.CaseDto
import com.edgecare.data.repository.CasesRepository
import com.edgecare.databinding.FragmentCaseReportBinding
import com.edgecare.util.CaseAiFormatter
import com.edgecare.util.EdgeCareToolbar
import com.edgecare.util.EmergencyContactUi
import com.google.android.material.button.MaterialButton
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import kotlinx.coroutines.launch

class CaseReportFragment : Fragment() {

    private var _binding: FragmentCaseReportBinding? = null
    private val binding get() = _binding!!
    private val args: CaseReportFragmentArgs by navArgs()

    private lateinit var repository: CasesRepository

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentCaseReportBinding.inflate(inflater, container, false)
        setupInsets(binding.root)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupDependencies()
        EdgeCareToolbar.bind(
            toolbar = binding.toolbar,
            subtitle = "Case report",
            showNavigation = true,
            onNavigationClick = { requireActivity().onBackPressedDispatcher.onBackPressed() }
        )
        loadCaseReport()
    }

    private fun setupDependencies() {
        val sessionStore = SessionStore(requireContext())
        val tokenProvider = DataStoreTokenProvider(sessionStore)
        val api = EdgeCareApiClient.create(tokenProvider).create(CasesApi::class.java)
        repository = CasesRepository(api)
    }

    private fun setupInsets(view: View) {
        ViewCompat.setOnApplyWindowInsetsListener(view) { target, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            target.setPadding(target.paddingLeft, systemBars.top, target.paddingRight, systemBars.bottom)
            insets
        }
    }

    private fun loadCaseReport() {
        val caseId = args.caseId
        if (caseId == -1) {
            Toast.makeText(context, "Invalid Case ID", Toast.LENGTH_SHORT).show()
            requireActivity().onBackPressedDispatcher.onBackPressed()
            return
        }

        binding.progressBar.isVisible = true
        viewLifecycleOwner.lifecycleScope.launch {
            repository.fetchCaseDetails(caseId)
                .onSuccess(::bindCaseReport)
                .onFailure {
                    Toast.makeText(context, "Failed to load case report", Toast.LENGTH_SHORT).show()
                }
            binding.progressBar.isVisible = false
        }
    }

    private fun bindCaseReport(case: CaseDto) {
        val aiUi = CaseAiFormatter.build(case)

        binding.tvReportCaseTitle.text = aiUi.overview.title
        binding.tvReportOverview.text = buildString {
            appendLine(aiUi.overview.reference)
            appendLine("Created: ${aiUi.overview.createdAt}")
            appendLine("Status: ${aiUi.overview.status}")
            appendLine("Assigned doctor: ${aiUi.overview.assignedDoctor}")
            appendLine("Reported symptoms: ${buildCaseIntakeSummary(case)}")
            append("Duration: ${case.intake?.duration ?: case.durationLabel ?: "Not provided"}")
        }

        binding.tvReportAiSummary.text = aiUi.finalAssessment.summary
        binding.tvReportAiDetails.text = aiUi.finalAssessment.details
        binding.tvReportAiNextStep.text = aiUi.finalAssessment.nextStep

        binding.cardReportEnvironment.isVisible = aiUi.environmentContext != null
        aiUi.environmentContext?.let { environment ->
            binding.tvReportEnvironmentSummary.text = environment.summary
            binding.tvReportEnvironmentGuidance.text = environment.guidance
        }

        binding.cardReportEmergency.isVisible = aiUi.emergencySupport != null
        aiUi.emergencySupport?.let { emergency ->
            binding.tvReportEmergencyLabel.text = emergency.label
            binding.tvReportEmergencyHeading.text = emergency.heading
            binding.tvReportEmergencyGuidance.text = emergency.guidance
            binding.tvReportEmergencyWarning.isVisible = !emergency.warning.isNullOrBlank()
            binding.tvReportEmergencyWarning.text = emergency.warning
            binding.tvReportEmergencyContacts.text = emergency.contactsText
            renderEmergencyActions(emergency.contacts)
        }
        if (aiUi.emergencySupport == null) {
            binding.layoutReportEmergencyActions.removeAllViews()
        }

        val doctorReview = aiUi.doctorReview
        binding.tvReportDoctorSummary.text = buildString {
            appendLine("Reviewed by: ${doctorReview.reviewer}")
            appendLine("Reviewed at: ${doctorReview.reviewedAt}")
            appendLine("Severity override: ${doctorReview.severity}")
            append("Follow-up needed: ${doctorReview.followUpNeeded}")
        }
        binding.tvReportDoctorNotes.isVisible = !doctorReview.notes.isNullOrBlank()
        binding.tvReportDoctorNotes.text = doctorReview.notes ?: ""
        binding.tvReportDoctorRecommendation.isVisible = !doctorReview.recommendation.isNullOrBlank()
        binding.tvReportDoctorRecommendation.text = doctorReview.recommendation ?: ""

        binding.tvReportFooter.text = aiUi.reportData.body
    }

    private fun renderEmergencyActions(contacts: List<EmergencyContactUi>) {
        binding.layoutReportEmergencyActions.removeAllViews()
        contacts.forEach { contact ->
            val button = MaterialButton(
                requireContext(),
                null,
                0
            ).apply {
                setTextAppearance(com.google.android.material.R.style.TextAppearance_Material3_LabelLarge)
                setBackgroundResource(R.drawable.bg_emergency_panel)
                text = "Call ${contact.label} (${contact.number})"
                icon = context.getDrawable(R.drawable.ic_phone)
                iconGravity = MaterialButton.ICON_GRAVITY_TEXT_START
                iconPadding = dpToPx(8)
                setTextColor(context.getColor(R.color.md_theme_error))
                iconTint = android.content.res.ColorStateList.valueOf(context.getColor(R.color.md_theme_error))
                setOnClickListener { openDialer(contact.number) }
                layoutParams = ViewGroup.MarginLayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = dpToPx(8)
                }
            }
            binding.layoutReportEmergencyActions.addView(button)
        }
    }

    private fun openDialer(number: String) {
        val sanitized = number.filter { it.isDigit() || it == '+' }
        if (sanitized.isBlank()) return
        startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$sanitized")))
    }

    private fun buildCaseIntakeSummary(case: CaseDto): String {
        val selectedSymptoms = extractSymptomSelections(case.symptoms)
        val structuredNotes = extractStructuredNotes(case.symptoms)
        return when {
            !case.description.isNullOrBlank() -> case.description
            !structuredNotes.isNullOrBlank() -> structuredNotes
            selectedSymptoms.isNotBlank() -> selectedSymptoms
            !case.triggers.isNullOrBlank() -> case.triggers
            else -> "No additional intake notes provided."
        }
    }

    private fun extractSymptomSelections(symptoms: JsonElement?): String {
        if (symptoms == null || symptoms.isJsonNull) return ""
        return when {
            symptoms.isJsonArray -> symptoms.asJsonArray.toSymptomString()
            symptoms.isJsonObject -> {
                val selected = symptoms.asJsonObject.get("selected")
                if (selected != null && selected.isJsonArray) {
                    selected.asJsonArray.toSymptomString()
                } else {
                    ""
                }
            }
            else -> ""
        }
    }

    private fun extractStructuredNotes(symptoms: JsonElement?): String {
        if (symptoms == null || !symptoms.isJsonObject) return ""
        val notes = symptoms.asJsonObject.get("additionalNotes") ?: return ""
        return runCatching { notes.asString }.getOrDefault("")
    }

    private fun JsonArray.toSymptomString(): String {
        return mapNotNull { element -> runCatching { element.asString }.getOrNull() }
            .joinToString(", ")
    }

    private fun dpToPx(dp: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp.toFloat(),
            resources.displayMetrics
        ).toInt()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
