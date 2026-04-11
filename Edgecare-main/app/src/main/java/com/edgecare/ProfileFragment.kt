package com.edgecare

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import com.edgecare.core.remote.EdgeCareApiClient
import com.edgecare.core.remote.EdgeCareApiService
import com.edgecare.core.session.DataStoreTokenProvider
import com.edgecare.core.session.SessionStore
import com.edgecare.core.ui.AppCenterToast
import com.edgecare.data.patient.PatientRepository
import com.edgecare.databinding.FragmentProfileBinding
import com.edgecare.ui.patient.PatientProfileViewModel
import com.edgecare.ui.patient.PatientProfileViewModelFactory
import com.edgecare.util.EdgeCareToolbar
import kotlinx.coroutines.launch

class ProfileFragment : Fragment() {

    private var _binding: FragmentProfileBinding? = null
    private val binding get() = _binding!!

    private lateinit var viewModel: PatientProfileViewModel

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentProfileBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Build dependencies (same pattern as EditProfileFragment)
        val sessionStore = SessionStore(requireContext())
        val tokenProvider = DataStoreTokenProvider(sessionStore)
        val apiService = EdgeCareApiClient.create(tokenProvider).create(EdgeCareApiService::class.java)
        val repository = PatientRepository(apiService)
        val factory = PatientProfileViewModelFactory(repository)

        viewModel = ViewModelProvider(requireActivity(), factory)[PatientProfileViewModel::class.java]

        EdgeCareToolbar.bind(binding.toolbar, subtitle = "Profile")

        binding.fabEditProfile.setOnClickListener {
            findNavController().navigate(R.id.action_navigation_profile_to_editProfileFragment)
        }

        binding.btnChangePassword.setOnClickListener {
            AppCenterToast.info(requireContext(), "Coming soon")
        }

        binding.btnLogout.setOnClickListener {
            // If you already have logout flow, call it here. For now:
            AppCenterToast.info(requireContext(), "Logged out")
            requireActivity().finish()
        }

        observeProfile()
    }

    override fun onResume() {
        super.onResume()
        // ✅ Ensure profile always loads when returning from edit screen
        viewModel.loadProfile()
    }

    private fun observeProfile() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->

                    state.profile?.let { p ->
                        val name = listOfNotNull(p.firstName?.trim(), p.lastName?.trim())
                            .filter { it.isNotBlank() }
                            .joinToString(" ")
                            .ifBlank { "Patient" }

                        binding.tvUserName.text = name
                        binding.tvUserEmail.text = p.user?.email ?: ""
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
