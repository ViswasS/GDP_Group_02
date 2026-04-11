package com.edgecare.ui.cases

import android.app.Activity
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
import android.widget.ArrayAdapter
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.os.bundleOf
import androidx.core.view.isVisible
import androidx.core.widget.doAfterTextChanged
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.edgecare.R
import com.edgecare.BuildConfig
import com.edgecare.core.remote.EdgeCareApiClient
import com.edgecare.core.remote.MlApiService
import com.edgecare.core.session.DataStoreTokenProvider
import com.edgecare.core.session.SessionStore
import com.edgecare.data.remote.api.CasesApi
import com.edgecare.data.remote.dto.CreateCaseRequest
import com.edgecare.data.remote.dto.SaveImagesRequest
import com.edgecare.data.remote.dto.SaveMlRequest
import com.edgecare.data.repository.CasesRepository
import com.edgecare.databinding.FragmentCreateCaseBinding
import com.edgecare.util.CloudinaryUploader
import com.edgecare.util.EdgeAiAnalyzer
import com.edgecare.util.EdgeCareToolbar
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class CreateCaseFragment : Fragment() {

    private var _binding: FragmentCreateCaseBinding? = null
    private val binding get() = _binding!!

    private lateinit var repository: CasesRepository
    private lateinit var mlApiService: MlApiService
    private lateinit var uploader: CloudinaryUploader
    private lateinit var imageAdapter: SelectedImageAdapter
    private lateinit var aiAnalyzer: EdgeAiAnalyzer

    private val selectedImages = mutableListOf<SelectedImage>()
    private val followUpAnswers = mutableMapOf<String, MutableMap<String, Any>>()
    private val climateLabelToValue = linkedMapOf<String, String>()
    private val exposureChipValues = mutableMapOf<Int, String>()

    private var quickPreview: JSONObject? = null

    private val pickImagesLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode != Activity.RESULT_OK) return@registerForActivityResult

        val data = result.data
        if (data?.clipData != null) {
            val count = data.clipData!!.itemCount
            for (index in 0 until count) {
                addImage(data.clipData!!.getItemAt(index).uri)
            }
        } else if (data?.data != null) {
            addImage(data.data!!)
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentCreateCaseBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupDependencies()
        setupUi()
    }

    private fun setupDependencies() {
        val sessionStore = SessionStore(requireContext())
        val tokenProvider = DataStoreTokenProvider(sessionStore)
        val retrofit = EdgeCareApiClient.create(tokenProvider)

        repository = CasesRepository(retrofit.create(CasesApi::class.java))

        val mlRetrofit = Retrofit.Builder()
            .baseUrl(BuildConfig.ML_BASE_URL.trimEnd('/') + "/")
            .addConverterFactory(GsonConverterFactory.create())
            .client(EdgeCareApiClient.provideMlOkHttpClient(tokenProvider))
            .build()

        mlApiService = mlRetrofit.create(MlApiService::class.java)
        uploader = CloudinaryUploader(requireContext())
        aiAnalyzer = EdgeAiAnalyzer(requireContext())
    }

    private fun setupUi() {
        EdgeCareToolbar.bind(
            toolbar = binding.toolbar,
            subtitle = "Create case",
            showNavigation = true,
            onNavigationClick = { findNavController().popBackStack() }
        )

        val durationLabels = arrayOf("Hours", "Days", "Weeks", "Months", "2 weeks", "1 month", "2+ months")
        binding.actvDurationLabel.setAdapter(
            ArrayAdapter(requireContext(), android.R.layout.simple_dropdown_item_1line, durationLabels)
        )

        val locations = arrayOf(
            "Face",
            "Scalp",
            "Neck",
            "Chest",
            "Back",
            "Arms",
            "Hands",
            "Legs",
            "Feet",
            "Groin",
            "Generalized"
        )
        binding.actvRashLocation.setAdapter(
            ArrayAdapter(requireContext(), android.R.layout.simple_dropdown_item_1line, locations)
        )

        binding.sliderSeverity.addOnChangeListener { _, value, _ ->
            binding.tvSeverityBadge.text = "${value.toInt()}/10"
        }
        binding.sliderItchiness.addOnChangeListener { _, value, _ ->
            binding.tvItchinessBadge.text = "${value.toInt()}/10"
        }

        imageAdapter = SelectedImageAdapter { image ->
            selectedImages.remove(image)
            imageAdapter.submitList(selectedImages.toList())
            refreshQuickPreview()
        }

        binding.rvImages.layoutManager =
            LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)
        binding.rvImages.adapter = imageAdapter

        setupEnvironmentInputs()
        setupQuestionnaireListeners()

        binding.btnAddPhoto.setOnClickListener { openGallery() }
        binding.btnSubmit.setOnClickListener { handleSubmit() }

        renderQuickPreview(null)
        refreshQuestionnaireUi()
    }

    private fun setupEnvironmentInputs() {
        climateLabelToValue.clear()
        CaseQuestionnaire.environmentOptions.forEach { option ->
            climateLabelToValue[option.label] = option.value
        }

        binding.actvEnvironmentClimate.setAdapter(
            ArrayAdapter(
                requireContext(),
                android.R.layout.simple_dropdown_item_1line,
                CaseQuestionnaire.environmentOptions.map { it.label }
            )
        )

        binding.cgEnvironmentExposure.removeAllViews()
        exposureChipValues.clear()
        CaseQuestionnaire.exposureOptions.forEach { option ->
            val chip = Chip(requireContext()).apply {
                text = option.label
                isCheckable = true
                setEnsureMinTouchTargetSize(false)
            }
            binding.cgEnvironmentExposure.addView(chip)
            exposureChipValues[chip.id] = option.value
        }
    }

    private fun setupQuestionnaireListeners() {
        for (index in 0 until binding.cgSymptoms.childCount) {
            (binding.cgSymptoms.getChildAt(index) as? Chip)?.setOnCheckedChangeListener { _, _ ->
                refreshQuestionnaireUi()
            }
        }

        binding.cgSpreading.setOnCheckedStateChangeListener { _, _ ->
            refreshQuestionnaireUi()
        }

        binding.cbEmergency.setOnCheckedChangeListener { _, _ ->
            refreshQuestionnaireUi()
        }

        binding.etDurationDays.doAfterTextChanged {
            refreshQuestionnaireUi()
        }

        binding.actvDurationLabel.doAfterTextChanged {
            refreshQuestionnaireUi()
        }

        binding.actvEnvironmentClimate.doAfterTextChanged {
            refreshQuestionnaireUi()
        }

        for (index in 0 until binding.cgEnvironmentExposure.childCount) {
            (binding.cgEnvironmentExposure.getChildAt(index) as? Chip)?.setOnCheckedChangeListener { _, _ ->
                refreshQuestionnaireUi()
            }
        }
    }

    private fun addImage(uri: Uri) {
        if (selectedImages.size >= 5) {
            Toast.makeText(context, "Maximum 5 images allowed", Toast.LENGTH_SHORT).show()
            return
        }

        selectedImages.add(SelectedImage(uri))
        imageAdapter.submitList(selectedImages.toList())
        refreshQuickPreview()
    }

    private fun openGallery() {
        val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
            type = "image/*"
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
        }
        pickImagesLauncher.launch(Intent.createChooser(intent, "Select Pictures"))
    }

    private fun handleSubmit() {
        val title = binding.etTitle.text.toString().trim()
        if (title.length < 3) {
            binding.tilTitle.error = "Title must be at least 3 characters"
            return
        }
        binding.tilTitle.error = null

        viewLifecycleOwner.lifecycleScope.launch {
            var caseId: Int? = null
            var mlPersisted = false
            try {
                setLoading(true)

                updateStatus("Creating case...")
                val createdCase = repository.createCase(buildRequest(emptyList())).getOrThrow()
                caseId = createdCase.id

                updateStatus("Uploading photos...")
                val imageUrls = uploadImagesIfNeeded()
                if (selectedImages.isNotEmpty() && imageUrls == null) {
                    throw Exception("Failed to upload selected photos")
                }

                if (!imageUrls.isNullOrEmpty()) {
                    updateStatus("Saving uploaded photos...")
                    repository.saveImages(caseId, SaveImagesRequest(imageUrls)).getOrThrow()
                }

                if (selectedImages.isNotEmpty()) {
                    updateStatus("Running final AI assessment...")
                    val backendAssessment = analyzeImageAuthoritatively(selectedImages.first().uri)

                    updateStatus("Saving final AI assessment...")
                    repository.saveMlResults(caseId, buildCompletedMlRequest(backendAssessment)).getOrThrow()
                    mlPersisted = true
                } else {
                    updateStatus("No photo selected. Final AI assessment will stay pending until an image is added.")
                }

                updateStatus("Refreshing case details...")
                val refreshedCase = repository.fetchCaseDetails(caseId).getOrThrow()
                ensureInitialAiSupport(refreshedCase)

                Toast.makeText(context, "Case submitted successfully", Toast.LENGTH_SHORT).show()
                findNavController().navigate(
                    R.id.caseDetailFragment,
                    bundleOf("caseId" to refreshedCase.id)
                )
            } catch (e: Exception) {
                val createdCaseId = caseId
                if (createdCaseId != null) {
                    if (selectedImages.isNotEmpty() && !mlPersisted) {
                        runCatching {
                            repository.saveMlResults(
                            createdCaseId,
                            SaveMlRequest(
                                mlLastError = e.message ?: "Final AI assessment failed",
                                mlStatus = "FAILED"
                            )
                        )
                        }
                    }

                    Toast.makeText(
                        context,
                        "Case created, but final AI assessment is not ready yet.",
                        Toast.LENGTH_LONG
                    ).show()
                    findNavController().navigate(
                        R.id.caseDetailFragment,
                        bundleOf("caseId" to createdCaseId)
                    )
                } else {
                    Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            } finally {
                setLoading(false)
            }
        }
    }

    private fun refreshQuestionnaireUi() {
        val state = currentQuestionnaireState()
        renderEnvironmentGuidance(state)
        renderFollowUpQuestions(state)
    }

    private fun currentQuestionnaireState(): QuestionnaireState {
        val spreadingChipId = binding.cgSpreading.checkedChipId
        val spreadingStatus = if (spreadingChipId != View.NO_ID) {
            binding.cgSpreading.findViewById<Chip>(spreadingChipId).text.toString()
        } else {
            null
        }

        return QuestionnaireState(
            selectedSymptoms = getSelectedSymptoms(),
            spreadingStatus = spreadingStatus,
            durationDays = binding.etDurationDays.text?.toString()?.toIntOrNull(),
            durationLabel = binding.actvDurationLabel.text?.toString()?.trim(),
            isEmergency = binding.cbEmergency.isChecked,
            environmentClimate = selectedEnvironmentClimate(),
            environmentalExposures = selectedEnvironmentalExposures()
        )
    }

    private fun renderEnvironmentGuidance(state: QuestionnaireState) {
        val guidance = CaseQuestionnaire.deriveEnvironmentGuidance(state)
        binding.tvEnvironmentContextNote.isVisible = guidance != null
        binding.tvEnvironmentContextNote.text = guidance?.let { "${it.eyebrow}\n${it.body}" }.orEmpty()
    }

    private fun renderFollowUpQuestions(state: QuestionnaireState) {
        val groups = CaseQuestionnaire.deriveVisibleFollowUpGroups(state)
        val visibleGroupIds = groups.mapTo(mutableSetOf()) { it.id }
        followUpAnswers.keys.retainAll(visibleGroupIds)

        binding.cardFollowUpQuestions.isVisible = groups.isNotEmpty()
        binding.layoutFollowUpQuestions.removeAllViews()

        if (groups.isEmpty()) {
            return
        }

        binding.tvFollowUpIntro.text =
            "Based on what you selected, a few short follow-up questions will be saved with the intake summary."

        groups.forEachIndexed { index, group ->
            binding.layoutFollowUpQuestions.addView(
                sectionTextView(group.title, 16f, isBold = true)
            )
            binding.layoutFollowUpQuestions.addView(
                sectionTextView(group.note, 14f, colorAttr = com.google.android.material.R.attr.colorOnSurfaceVariant)
            )

            group.fields.forEach { field ->
                binding.layoutFollowUpQuestions.addView(
                    sectionTextView(field.label, 14f, topMarginDp = 12)
                )
                binding.layoutFollowUpQuestions.addView(buildFollowUpChipGroup(group, field))
            }

            group.alert?.let { alert ->
                binding.layoutFollowUpQuestions.addView(
                    sectionTextView(
                        text = alert,
                        textSizeSp = 13f,
                        colorAttr = com.google.android.material.R.attr.colorError,
                        topMarginDp = 12
                    )
                )
            }

            if (index < groups.lastIndex) {
                binding.layoutFollowUpQuestions.addView(spacerView())
            }
        }
    }

    private fun buildFollowUpChipGroup(group: FollowUpGroup, field: FollowUpField): ChipGroup {
        val chipGroup = ChipGroup(requireContext()).apply {
            isSingleSelection = true
            chipSpacingHorizontal = dpToPx(8)
            chipSpacingVertical = dpToPx(8)
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dpToPx(8)
            }
        }

        val options = when (field.type) {
            QuestionnaireFieldType.BOOLEAN -> listOf(
                field.trueLabel to true,
                field.falseLabel to false
            )
            QuestionnaireFieldType.CHOICE -> field.options.map { it to it }
        }

        options.forEach { (label, value) ->
            val chip = Chip(requireContext()).apply {
                text = label
                isCheckable = true
                setEnsureMinTouchTargetSize(false)
                tag = value
            }
            if (currentFollowUpValue(group.id, field.key) == value) {
                chip.isChecked = true
            }
            chipGroup.addView(chip)
        }

        chipGroup.setOnCheckedStateChangeListener { checkedGroup, checkedIds ->
            val selectedChip = checkedIds.firstOrNull()
                ?.let { checkedGroup.findViewById<Chip>(it) }
            if (selectedChip == null) {
                clearFollowUpAnswer(group.id, field.key)
            } else {
                updateFollowUpAnswer(group.id, field.key, selectedChip.tag)
            }
        }

        return chipGroup
    }

    private fun updateFollowUpAnswer(groupId: String, fieldKey: String, value: Any?) {
        if (value == null) {
            clearFollowUpAnswer(groupId, fieldKey)
            return
        }

        val groupAnswers = followUpAnswers.getOrPut(groupId) { mutableMapOf() }
        groupAnswers[fieldKey] = value
    }

    private fun clearFollowUpAnswer(groupId: String, fieldKey: String) {
        val groupAnswers = followUpAnswers[groupId] ?: return
        groupAnswers.remove(fieldKey)
        if (groupAnswers.isEmpty()) {
            followUpAnswers.remove(groupId)
        }
    }

    private fun currentFollowUpValue(groupId: String, fieldKey: String): Any? {
        return followUpAnswers[groupId]?.get(fieldKey)
    }

    private fun sectionTextView(
        text: String,
        textSizeSp: Float,
        isBold: Boolean = false,
        colorAttr: Int = com.google.android.material.R.attr.colorOnSurface,
        topMarginDp: Int = 0
    ): TextView {
        return TextView(requireContext()).apply {
            this.text = text
            setTextSize(TypedValue.COMPLEX_UNIT_SP, textSizeSp)
            setTextColor(resolveThemeColor(colorAttr))
            if (isBold) {
                setTypeface(typeface, android.graphics.Typeface.BOLD)
            }
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                if (topMarginDp > 0) {
                    topMargin = dpToPx(topMarginDp)
                }
            }
        }
    }

    private fun spacerView(): View {
        return View(requireContext()).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dpToPx(1)
            ).apply {
                topMargin = dpToPx(16)
                bottomMargin = dpToPx(16)
            }
            setBackgroundColor(resolveThemeColor(com.google.android.material.R.attr.colorOutline))
        }
    }

    private fun selectedEnvironmentClimate(): String? {
        val label = binding.actvEnvironmentClimate.text?.toString()?.trim().orEmpty()
        if (label.isBlank()) return null
        return climateLabelToValue[label]
            ?: CaseQuestionnaire.environmentOptions.firstOrNull { it.value == label }?.value
    }

    private fun selectedEnvironmentalExposures(): List<String> {
        val selected = mutableListOf<String>()
        for (index in 0 until binding.cgEnvironmentExposure.childCount) {
            val chip = binding.cgEnvironmentExposure.getChildAt(index) as? Chip ?: continue
            if (chip.isChecked) {
                exposureChipValues[chip.id]?.let(selected::add)
            }
        }
        return selected
    }

    private fun updateStatus(text: String) {
        binding.tvPipelineStatus.text = text
        binding.tvPipelineStatus.isVisible = text.isNotBlank()
    }

    private fun refreshQuickPreview() {
        val firstImage = selectedImages.firstOrNull()?.uri
        if (firstImage == null) {
            quickPreview = null
            renderQuickPreview(null)
            return
        }

        viewLifecycleOwner.lifecycleScope.launch {
            renderQuickPreviewLoading()
            val bitmap = getBitmapFromUri(firstImage)
            quickPreview = bitmap?.let(aiAnalyzer::analyze)
            renderQuickPreview(quickPreview)
        }
    }

    private fun renderQuickPreviewLoading() {
        binding.cardQuickPreview.isVisible = true
        binding.tvQuickPreviewSummary.text = "Generating quick on-device severity preview..."
        binding.tvQuickPreviewMeta.text = ""
        binding.tvQuickPreviewNote.text =
            "Optional preview only. Final AI assessment comes from backend image analysis."
    }

    private fun renderQuickPreview(result: JSONObject?) {
        val hasImages = selectedImages.isNotEmpty()
        binding.cardQuickPreview.isVisible = hasImages

        if (!hasImages) {
            binding.tvQuickPreviewSummary.text = ""
            binding.tvQuickPreviewMeta.text = ""
            binding.tvQuickPreviewNote.text = ""
            return
        }

        if (result == null) {
            binding.tvQuickPreviewSummary.text = "Quick on-device preview unavailable"
            binding.tvQuickPreviewMeta.text = "Select a clearer image to try again."
            binding.tvQuickPreviewNote.text =
                "Optional preview only. Final AI assessment comes from backend image analysis."
            return
        }

        val severity = result.optString("predicted_class", "unknown").replaceFirstChar { char ->
            if (char.isLowerCase()) char.titlecase() else char.toString()
        }
        val confidence = result.optDouble("confidence", Double.NaN)

        binding.tvQuickPreviewSummary.text = severity
        binding.tvQuickPreviewMeta.text =
            if (confidence.isNaN()) {
                "On-device severity preview"
            } else {
                "Confidence ${(confidence * 100).toInt()}%"
            }
        binding.tvQuickPreviewNote.text =
            "Optional preview only. Final AI assessment comes from backend image analysis."
    }

    private suspend fun getBitmapFromUri(uri: Uri?): Bitmap? = withContext(Dispatchers.IO) {
        if (uri == null) return@withContext null

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val source = ImageDecoder.createSource(requireContext().contentResolver, uri)
                ImageDecoder.decodeBitmap(source) { decoder, _, _ ->
                    decoder.isMutableRequired = true
                }
            } else {
                MediaStore.Images.Media.getBitmap(requireContext().contentResolver, uri)
            }
        } catch (_: Exception) {
            null
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

    private suspend fun ensureInitialAiSupport(case: com.edgecare.data.remote.dto.CaseDto) {
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

    private suspend fun uploadImagesIfNeeded(): List<String>? {
        val urls = mutableListOf<String>()
        for (image in selectedImages) {
            if (image.uploadUrl != null) {
                urls.add(image.uploadUrl!!)
                continue
            }

            image.isUploading = true
            withContext(Dispatchers.Main) {
                imageAdapter.notifyItemChanged(selectedImages.indexOf(image))
            }

            val result = uploader.uploadImage(image.uri)
            image.isUploading = false

            if (result.isSuccess) {
                val url = result.getOrNull()!!
                image.uploadUrl = url
                urls.add(url)
                withContext(Dispatchers.Main) {
                    imageAdapter.notifyItemChanged(selectedImages.indexOf(image))
                }
            } else {
                withContext(Dispatchers.Main) {
                    Toast.makeText(context, "Failed to upload an image", Toast.LENGTH_SHORT).show()
                    imageAdapter.notifyItemChanged(selectedImages.indexOf(image))
                }
                return null
            }
        }
        return urls
    }

    private fun getSelectedSymptoms(): List<String> {
        val symptoms = mutableListOf<String>()
        for (index in 0 until binding.cgSymptoms.childCount) {
            val chip = binding.cgSymptoms.getChildAt(index) as Chip
            if (chip.isChecked) symptoms.add(chip.text.toString())
        }
        return symptoms
    }

    private fun collectFollowUpPayload(state: QuestionnaireState): JsonObject? {
        val groups = CaseQuestionnaire.deriveVisibleFollowUpGroups(state)
        val payload = JsonObject()

        groups.forEach { group ->
            val answers = followUpAnswers[group.id].orEmpty()
            if (answers.isEmpty()) return@forEach

            val answerObject = JsonObject()
            answers.forEach { (fieldKey, value) ->
                when (value) {
                    is Boolean -> answerObject.addProperty(fieldKey, value)
                    else -> answerObject.addProperty(fieldKey, value.toString())
                }
            }

            if (answerObject.size() > 0) {
                payload.add(group.id, answerObject)
            }
        }

        return payload.takeIf { it.size() > 0 }
    }

    private fun buildStructuredSymptomsPayload(): JsonObject? {
        val selectedSymptoms = getSelectedSymptoms()
        val additionalNotes = binding.etDescription.text.toString().trim().ifBlank { null }
        val state = currentQuestionnaireState()
        val followUps = collectFollowUpPayload(state)
        val environmentClimate = state.environmentClimate
        val environmentalExposures = state.environmentalExposures

        val environmentContext = if (environmentClimate != null || environmentalExposures.isNotEmpty()) {
            JsonObject().apply {
                environmentClimate?.let { addProperty("climate", it) }
                if (environmentalExposures.isNotEmpty()) {
                    add("exposures", environmentalExposures.toJsonArray())
                }
            }
        } else {
            null
        }

        if (selectedSymptoms.isEmpty() && followUps == null && additionalNotes == null && environmentContext == null) {
            return null
        }

        return JsonObject().apply {
            if (selectedSymptoms.isNotEmpty()) {
                add("selected", selectedSymptoms.toJsonArray())
            }
            followUps?.let { add("followUps", it) }
            additionalNotes?.let { addProperty("additionalNotes", it) }
            environmentContext?.let { add("environmentContext", it) }
        }
    }

    private fun buildRequest(imageUrls: List<String>): CreateCaseRequest {
        val spreadingChipId = binding.cgSpreading.checkedChipId
        val spreadingStatus = if (spreadingChipId != View.NO_ID) {
            binding.cgSpreading.findViewById<Chip>(spreadingChipId).text.toString()
        } else {
            null
        }

        return CreateCaseRequest(
            title = binding.etTitle.text.toString(),
            duration = binding.etDurationDays.text.toString().ifBlank { null },
            durationDays = binding.etDurationDays.text.toString().toIntOrNull(),
            durationLabel = binding.actvDurationLabel.text.toString().ifBlank { null },
            medications = binding.etMedications.text.toString().ifBlank { null },
            isEmergency = binding.cbEmergency.isChecked,
            description = binding.etDescription.text.toString().ifBlank { null },
            rashLocation = binding.actvRashLocation.text.toString().ifBlank { null },
            symptoms = buildStructuredSymptomsPayload(),
            severity = binding.sliderSeverity.value.toInt(),
            itchiness = binding.sliderItchiness.value.toInt(),
            spreadingStatus = spreadingStatus,
            triggers = binding.etTriggers.text.toString().ifBlank { null },
            imageUrls = if (imageUrls.isNotEmpty()) imageUrls else null
        )
    }

    private fun List<String>.toJsonArray(): JsonArray {
        return JsonArray().also { array ->
            forEach(array::add)
        }
    }

    private fun resolveThemeColor(attr: Int): Int {
        val typedValue = TypedValue()
        requireContext().theme.resolveAttribute(attr, typedValue, true)
        return typedValue.data
    }

    private fun dpToPx(dp: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp.toFloat(),
            resources.displayMetrics
        ).toInt()
    }

    private fun setLoading(isLoading: Boolean) {
        binding.btnSubmit.isEnabled = !isLoading
        binding.btnAddPhoto.isEnabled = !isLoading
        binding.submitProgress.visibility = if (isLoading) View.VISIBLE else View.GONE
        if (!isLoading && binding.tvPipelineStatus.text.isNullOrBlank()) {
            binding.tvPipelineStatus.isVisible = false
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
