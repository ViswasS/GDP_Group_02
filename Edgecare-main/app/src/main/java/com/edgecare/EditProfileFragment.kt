package com.edgecare

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import androidx.fragment.app.Fragment
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import com.edgecare.core.remote.EdgeCareApiClient
import com.edgecare.core.remote.EdgeCareApiService
import com.edgecare.core.remote.PatientProfileUpdateRequest
import com.edgecare.core.session.DataStoreTokenProvider
import com.edgecare.core.session.SessionStore
import com.edgecare.core.ui.AppCenterToast
import com.edgecare.data.patient.PatientRepository
import com.edgecare.databinding.FragmentEditProfileBinding
import com.edgecare.ui.patient.PatientProfileViewModel
import com.edgecare.ui.patient.PatientProfileViewModelFactory
import com.google.android.material.datepicker.MaterialDatePicker
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

class EditProfileFragment : Fragment() {

    private var _binding: FragmentEditProfileBinding? = null
    private val binding get() = _binding!!

    private lateinit var viewModel: PatientProfileViewModel
    private val apiDateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    private val displayDateFormat = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentEditProfileBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val sessionStore = SessionStore(requireContext())
        val tokenProvider = DataStoreTokenProvider(sessionStore)
        val apiService = EdgeCareApiClient.create(tokenProvider).create(EdgeCareApiService::class.java)
        val repository = PatientRepository(apiService)
        val factory = PatientProfileViewModelFactory(repository)
        viewModel = ViewModelProvider(requireActivity(), factory)[PatientProfileViewModel::class.java]

        setupGenderDropdown()
        setupDatePicker()
        setupListeners()
        observeViewModel()
        viewModel.loadProfile()

    }

    private fun setupGenderDropdown() {
        val genders = arrayOf("Male", "Female", "Other", "Prefer not to say")
        val adapter = ArrayAdapter(requireContext(), android.R.layout.simple_dropdown_item_1line, genders)
        binding.actGender.setAdapter(adapter)
    }

    private fun setupDatePicker() {
        binding.etDob.setOnClickListener {
            val datePicker = MaterialDatePicker.Builder.datePicker()
                .setTitleText("Select Date of Birth")
                .build()

            datePicker.addOnPositiveButtonClickListener { selection ->
                val calendar = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
                calendar.timeInMillis = selection
                binding.etDob.setText(displayDateFormat.format(calendar.time))
            }

            datePicker.show(parentFragmentManager, "DATE_PICKER")
        }
    }

    private fun setupListeners() {
        binding.btnBack.setOnClickListener { findNavController().navigateUp() }
        binding.btnCancel.setOnClickListener { findNavController().navigateUp() }

        binding.btnSubmit.setOnClickListener {
            saveProfile()
        }
    }

    private fun saveProfile() {
        val firstName = binding.etFirstName.text.toString().trim()
        val lastName = binding.etLastName.text.toString().trim()
        val genderStr = binding.actGender.text.toString()
        val dobStr = binding.etDob.text.toString()

        val genderValue = when (genderStr) {
            "Male" -> "MALE"
            "Female" -> "FEMALE"
            "Other" -> "OTHER"
            "Prefer not to say" -> "PREFER_NOT_TO_SAY"
            else -> null
        }

        val dobValue = try {
            val date = displayDateFormat.parse(dobStr)
            if (date != null) apiDateFormat.format(date) else null
        } catch (e: Exception) {
            null
        }

        val current = viewModel.uiState.value.profile

        val request = PatientProfileUpdateRequest(
            firstName = firstName.ifEmpty { null },
            lastName = lastName.ifEmpty { null },
            gender = genderValue,
            dob = dobValue,
            language = current?.language,
            consentStatus = current?.consentStatus
        )

        viewModel.updateProfile(request)
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    binding.btnSubmit.isEnabled = !state.loading
                    
                    state.profile?.let { profile ->
                        if (binding.etFirstName.text.isNullOrEmpty()) {
                            binding.etFirstName.setText(profile.firstName)
                        }
                        if (binding.etLastName.text.isNullOrEmpty()) {
                            binding.etLastName.setText(profile.lastName)
                        }
                        if (binding.actGender.text.isNullOrEmpty()) {
                            val genderDisplay = when (profile.gender) {
                                "MALE" -> "Male"
                                "FEMALE" -> "Female"
                                "OTHER" -> "Other"
                                "PREFER_NOT_TO_SAY" -> "Prefer not to say"
                                else -> profile.gender
                            }
                            binding.actGender.setText(genderDisplay, false)
                        }
                        if (binding.etDob.text.isNullOrEmpty() && !profile.dob.isNullOrEmpty()) {
                            try {
                                if (binding.etDob.text.isNullOrEmpty() && !profile.dob.isNullOrEmpty()) {
                                    try {
                                        val apiDob = profile.dob.substringBefore("T") // ✅ strips ISO time if present
                                        val date = apiDateFormat.parse(apiDob)
                                        if (date != null) binding.etDob.setText(displayDateFormat.format(date))
                                    } catch (_: Exception) { }
                                }
                            } catch (e: Exception) {}
                        }
                    }

                    state.successMessage?.let {
                        AppCenterToast.success(requireContext(), it)
                        viewModel.clearMessages()
                        findNavController().navigateUp()
                    }

                    state.errorMessage?.let {
                        AppCenterToast.error(requireContext(), it)
                        viewModel.clearMessages()
                    }
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
