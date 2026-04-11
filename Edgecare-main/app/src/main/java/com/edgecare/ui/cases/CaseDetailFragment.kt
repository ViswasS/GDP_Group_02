package com.edgecare.ui.cases

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.util.TypedValue
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.webkit.MimeTypeMap
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.os.bundleOf
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import com.edgecare.R
import com.edgecare.BuildConfig
import com.edgecare.core.remote.EdgeCareApiClient
import com.edgecare.core.remote.MlApiService
import com.edgecare.core.session.DataStoreTokenProvider
import com.edgecare.core.session.SessionStore
import com.edgecare.data.remote.api.CasesApi
import com.edgecare.data.remote.dto.CaseDto
import com.edgecare.data.remote.dto.SaveImagesRequest
import com.edgecare.data.remote.dto.SaveMlRequest
import com.edgecare.data.repository.CasesRepository
import com.edgecare.databinding.FragmentCaseDetailBinding
import com.edgecare.util.CaseAiFormatter
import com.edgecare.util.CaseStatusMapper
import com.edgecare.util.CloudinaryUploader
import com.edgecare.util.EdgeCareToolbar
import com.edgecare.util.EmergencyContactUi
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class CaseDetailFragment : Fragment() {

    private var _binding: FragmentCaseDetailBinding? = null
    private val binding get() = _binding!!
    private val args: CaseDetailFragmentArgs by navArgs()

    private lateinit var repository: CasesRepository
    private lateinit var mlApiService: MlApiService
    private lateinit var uploader: CloudinaryUploader

    private var currentCase: CaseDto? = null
    private var requestingDoctor = false
    private var reuploadingImage = false

    private val reuploadPicker = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            reuploadImage(uri)
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentCaseDetailBinding.inflate(inflater, container, false)
        setupInsets(binding.root)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val sessionStore = SessionStore(requireContext())
        val tokenProvider = DataStoreTokenProvider(sessionStore)
        val api = EdgeCareApiClient.create(tokenProvider).create(CasesApi::class.java)
        repository = CasesRepository(api)

        val mlRetrofit = Retrofit.Builder()
            .baseUrl(BuildConfig.ML_BASE_URL.trimEnd('/') + "/")
            .addConverterFactory(GsonConverterFactory.create())
            .client(EdgeCareApiClient.provideMlOkHttpClient(tokenProvider))
            .build()
        mlApiService = mlRetrofit.create(MlApiService::class.java)
        uploader = CloudinaryUploader(requireContext())

        setupToolbar()
        setupActions()
        loadCaseDetails()
    }

    private fun setupInsets(view: View) {
        ViewCompat.setOnApplyWindowInsetsListener(view) { target, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            target.setPadding(target.paddingLeft, systemBars.top, target.paddingRight, systemBars.bottom)
            insets
        }
    }

    private fun setupToolbar() {
        EdgeCareToolbar.bind(
            toolbar = binding.toolbar,
            subtitle = "Case details",
            showNavigation = true,
            onNavigationClick = { findNavController().navigateUp() }
        )
    }

    private fun setupActions() {
        binding.btnOpenChat.setOnClickListener {
            val case = currentCase ?: return@setOnClickListener
            findNavController().navigate(
                R.id.action_caseDetailFragment_to_chatFragment,
                bundleOf("caseId" to case.id)
            )
        }

        binding.btnRequestDoctorReview.setOnClickListener {
            requestDoctorReview()
        }

        binding.btnReuploadImage.setOnClickListener {
            reuploadPicker.launch("image/*")
        }

        binding.btnViewReport.setOnClickListener {
            val case = currentCase ?: return@setOnClickListener
            findNavController().navigate(
                R.id.action_caseDetailFragment_to_caseReportFragment,
                bundleOf("caseId" to case.id)
            )
        }
    }

    private fun loadCaseDetails() {
        val caseId = args.caseId
        if (caseId == -1) {
            Toast.makeText(context, "Invalid Case ID", Toast.LENGTH_SHORT).show()
            findNavController().navigateUp()
            return
        }

        binding.progressBar.isVisible = true
        viewLifecycleOwner.lifecycleScope.launch {
            repository.fetchCaseDetails(caseId)
                .onSuccess {
                    currentCase = it
                    bindCaseData(it)
                }
                .onFailure {
                    Toast.makeText(context, "Failed to load case details", Toast.LENGTH_SHORT).show()
                }
            binding.progressBar.isVisible = false
        }
    }

    private fun bindCaseData(case: CaseDto) {
        binding.tvCaseTitle.text = case.intake?.title ?: case.description ?: "Untitled Case"
        binding.tvCaseId.text = "Case #${case.id}"
        binding.tvStatus.text = CaseStatusMapper.mapStatus(case.status)
        updateStatusBadge(case.status)

        binding.tvDate.text = case.submittedAt
        binding.tvSymptoms.text = buildCaseIntakeSummary(case)
        binding.tvDuration.text = case.intake?.duration ?: case.durationLabel ?: "N/A"
        binding.tvMedication.text = case.intake?.medications ?: "None"

        val aiUi = CaseAiFormatter.build(case)
        binding.tvFinalAiStatus.text =
            if (aiUi.finalAssessment.isCompleted) "Final AI assessment" else "Final AI assessment pending"
        binding.tvFinalAiSummary.text = aiUi.finalAssessment.summary
        binding.tvFinalAiDetails.text = aiUi.finalAssessment.details
        binding.tvFinalAiNextStep.text = aiUi.finalAssessment.nextStep

        val environment = aiUi.environmentContext
        binding.cardEnvironmentContext.isVisible = environment != null
        if (environment != null) {
            binding.tvEnvironmentSummary.text = environment.summary
            binding.tvEnvironmentGuidance.text = environment.guidance
        }

        val emergency = aiUi.emergencySupport
        binding.cardEmergencySupport.isVisible = emergency != null
        if (emergency != null) {
            binding.tvEmergencyLabel.text = emergency.label
            binding.tvEmergencyHeading.text = emergency.heading
            binding.tvEmergencyGuidance.text = emergency.guidance
            binding.tvEmergencyWarning.isVisible = !emergency.warning.isNullOrBlank()
            binding.tvEmergencyWarning.text = emergency.warning
            binding.tvEmergencyContacts.text = emergency.contactsText
            renderEmergencyActions(emergency.contacts)
        }
        if (emergency == null) {
            binding.layoutEmergencyActions.removeAllViews()
        }
        binding.layoutEmergencyActions.isVisible = emergency != null

        val doctorReview = aiUi.doctorReview
        binding.tvDoctorReviewSummary.text = buildString {
            appendLine("Reviewed by: ${doctorReview.reviewer}")
            appendLine("Reviewed at: ${doctorReview.reviewedAt}")
            appendLine("Severity override: ${doctorReview.severity}")
            append("Follow-up needed: ${doctorReview.followUpNeeded}")
        }
        binding.tvDoctorReviewNotes.isVisible = !doctorReview.notes.isNullOrBlank()
        binding.tvDoctorReviewNotes.text = doctorReview.notes ?: ""
        binding.tvDoctorReviewRecommendation.isVisible = !doctorReview.recommendation.isNullOrBlank()
        binding.tvDoctorReviewRecommendation.text = doctorReview.recommendation ?: ""

        binding.tvReportData.text = aiUi.reportData.body

        val doctor = case.assignedDoctor
        if (doctor != null) {
            binding.tvDoctorName.text = listOfNotNull(doctor.firstName, doctor.lastName)
                .joinToString(" ")
                .ifBlank { "Assigned doctor" }
                .let { "Dr. $it" }
            binding.tvDoctorSpecialty.text = "Doctor review in progress"
            binding.tvChatNote.text = "You can continue chatting here while the doctor review is active."
            binding.tvChatNote.isVisible = true
        } else {
            binding.tvDoctorName.text = "AI Support Active"
            binding.tvDoctorSpecialty.text = "No doctor assigned yet"
            binding.tvChatNote.text = "AI support is available now. Request doctor review if you want a human review."
            binding.tvChatNote.isVisible = true
        }

        val actions = aiUi.actions
        binding.btnRequestDoctorReview.isVisible = actions.canRequestDoctorReview || requestingDoctor
        binding.btnRequestDoctorReview.isEnabled = !requestingDoctor && actions.canRequestDoctorReview
        binding.btnRequestDoctorReview.text = when {
            requestingDoctor -> "Requesting doctor review..."
            else -> actions.doctorReviewLabel
        }

        binding.btnReuploadImage.isVisible = actions.canReuploadImage || reuploadingImage
        binding.btnReuploadImage.isEnabled = !reuploadingImage && actions.canReuploadImage
        binding.btnReuploadImage.text = if (reuploadingImage) "Re-uploading image..." else actions.reuploadLabel

        binding.tvCaseActionNote.isVisible = !actions.reuploadReason.isNullOrBlank()
        binding.tvCaseActionNote.text = actions.reuploadReason

        binding.btnOpenChat.text = if (case.assignedDoctor != null) "Open Support Chat" else "Open AI Chat"
    }

    private fun renderEmergencyActions(contacts: List<EmergencyContactUi>) {
        binding.layoutEmergencyActions.removeAllViews()
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
            binding.layoutEmergencyActions.addView(button)
        }
    }

    private fun openDialer(number: String) {
        val sanitized = number.filter { it.isDigit() || it == '+' }
        if (sanitized.isBlank()) return
        val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$sanitized"))
        startActivity(intent)
    }

    private fun requestDoctorReview() {
        val case = currentCase ?: return
        if (requestingDoctor) return

        viewLifecycleOwner.lifecycleScope.launch {
            requestingDoctor = true
            bindCaseData(case)
            try {
                val result = repository.requestDoctorReview(case.id).getOrThrow()
                delay(300)
                val refreshed = repository.fetchCaseDetails(case.id).getOrThrow()
                currentCase = refreshed
                bindCaseData(refreshed)
                Toast.makeText(
                    context,
                    result.message ?: "Doctor review request submitted",
                    Toast.LENGTH_SHORT
                ).show()
            } catch (e: Exception) {
                Toast.makeText(context, e.message ?: "Unable to request doctor review", Toast.LENGTH_SHORT).show()
            } finally {
                requestingDoctor = false
                currentCase?.let(::bindCaseData)
            }
        }
    }

    private fun reuploadImage(uri: Uri) {
        val case = currentCase ?: return
        if (reuploadingImage) return

        viewLifecycleOwner.lifecycleScope.launch {
            reuploadingImage = true
            bindCaseData(case)
            var imageReplaced = false
            var mlPersisted = false
            try {
                val uploadedUrl = uploader.uploadImage(uri).getOrThrow()
                repository.reuploadImage(case.id, SaveImagesRequest(listOf(uploadedUrl))).getOrThrow()
                imageReplaced = true

                val authoritativeResult = analyzeImageAuthoritatively(uri)
                repository.saveMlResults(case.id, buildCompletedMlRequest(authoritativeResult)).getOrThrow()
                mlPersisted = true

                val refreshed = repository.fetchCaseDetails(case.id).getOrThrow()
                ensurePostAnalysisAiSupport(refreshed)
                currentCase = refreshed
                bindCaseData(refreshed)
                Toast.makeText(context, "Image updated and final AI assessment refreshed", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                if (imageReplaced && !mlPersisted) {
                    runCatching {
                        repository.saveMlResults(
                            case.id,
                            SaveMlRequest(
                                mlLastError = e.message ?: "Image re-upload failed",
                                mlStatus = "FAILED"
                            )
                        ).getOrThrow()
                    }
                }
                Toast.makeText(context, e.message ?: "Unable to re-upload image", Toast.LENGTH_SHORT).show()
            } finally {
                reuploadingImage = false
                currentCase?.let(::bindCaseData)
            }
        }
    }

    private suspend fun analyzeImageAuthoritatively(uri: Uri): JsonObject = withContext(Dispatchers.IO) {
        warmUpMlService()
        val part = buildImagePart(uri) ?: throw Exception("Unable to prepare the selected image")
        val response = mlApiService.analyzeImage(part)
        if (!response.isSuccessful) {
            throw Exception(parseMlError(response.errorBody()?.string()))
        }
        parseMlJsonObject(response.body()?.string())
            ?: throw Exception("Backend image analysis returned an unexpected response")
    }

    private suspend fun buildImagePart(uri: Uri): MultipartBody.Part? = withContext(Dispatchers.IO) {
        val contentResolver = requireContext().contentResolver
        val mimeType = contentResolver.getType(uri) ?: "image/jpeg"
        val extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType) ?: "jpg"
        val bytes = contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return@withContext null
        val requestBody = bytes.toRequestBody(mimeType.toMediaTypeOrNull())
        MultipartBody.Part.createFormData("file", "case-image.$extension", requestBody)
    }

    private fun buildCompletedMlRequest(result: JsonObject): SaveMlRequest {
        val finalAssessment = result.deepCopy()
        val report = JsonObject().apply {
            addProperty("source", "ml/analyze-image")
            add("finalAssessment", finalAssessment.deepCopy())
        }
        return SaveMlRequest(
            mlImageResult = result.deepCopy(),
            mlFusedResult = finalAssessment,
            mlReport = report,
            mlStatus = "COMPLETED"
        )
    }

    private fun parseMlJsonObject(payload: String?): JsonObject? {
        if (payload.isNullOrBlank()) return null
        val element = runCatching { JsonParser.parseString(payload) }.getOrNull() ?: return null
        if (element.isJsonObject) {
            val body = element.asJsonObject
            val nestedData = body.get("data")
            return when {
                nestedData != null && nestedData.isJsonObject -> nestedData.asJsonObject
                nestedData != null && nestedData.isJsonPrimitive && nestedData.asJsonPrimitive.isString ->
                    parseMlJsonObject(nestedData.asString)
                else -> body
            }
        }
        if (element.isJsonPrimitive && element.asJsonPrimitive.isString) {
            return runCatching { JsonParser.parseString(element.asString) }
                .getOrNull()
                ?.takeIf { it.isJsonObject }
                ?.asJsonObject
        }
        return null
    }

    private fun parseMlError(payload: String?): String {
        if (payload.isNullOrBlank()) return "Backend image analysis failed"
        val parsed = runCatching { JsonParser.parseString(payload) }.getOrNull()
        if (parsed?.isJsonObject == true) {
            val message = parsed.asJsonObject.get("message")
            if (message != null && message.isJsonPrimitive && message.asJsonPrimitive.isString) {
                return message.asString
            }
        }
        if (payload.trim().startsWith("<")) {
            return "Backend image analysis endpoint returned an unexpected response"
        }
        return payload.take(160)
    }

    private suspend fun warmUpMlService() {
        repeat(3) { attempt ->
            val result = runCatching { mlApiService.health() }.getOrNull()
            result?.body()?.close()
            result?.errorBody()?.close()
            if (result?.isSuccessful == true) {
                return
            }
            if (attempt < 2) {
                delay(2000)
            }
        }
        throw Exception("AI service is waking up. Please try again in a moment.")
    }

    private suspend fun ensurePostAnalysisAiSupport(case: CaseDto) {
        if (!case.mlStatus.equals("COMPLETED", ignoreCase = true)) return

        runCatching {
            val plan = repository.buildAutoAiSupportPlan(
                caseId = case.id.toLong(),
                caseData = case
            ).getOrThrow()

            if (plan.shouldTrigger && !plan.prompt.isNullOrBlank()) {
                repository.triggerAiSupport(case.id.toLong(), plan.prompt).getOrThrow()
            }
        }
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

    private fun updateStatusBadge(status: String?) {
        binding.tvStatus.setBackgroundResource(CaseStatusMapper.getStatusBackgroundRes(status))
        binding.tvStatus.setTextColor(CaseStatusMapper.getStatusColor(requireContext(), status))
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
