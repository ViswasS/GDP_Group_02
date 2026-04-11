package com.edgecare

import android.os.Bundle
import android.util.Patterns
import android.view.View
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.edgecare.ui.auth.AuthViewModel
import com.edgecare.ui.auth.AuthViewModelFactory
import com.google.android.material.button.MaterialButton
import com.google.android.material.progressindicator.CircularProgressIndicator
import com.google.android.material.textfield.TextInputLayout
import kotlinx.coroutines.launch
import com.edgecare.core.ui.AppCenterToast

class RegisterActivity : ComponentActivity() {

    private lateinit var vm: AuthViewModel

    private lateinit var tilFirstName: TextInputLayout
    private lateinit var tilLastName: TextInputLayout
    private lateinit var tilEmail: TextInputLayout
    private lateinit var tilPhone: TextInputLayout
    private lateinit var tilPassword: TextInputLayout
    private lateinit var tilConfirmPassword: TextInputLayout
    private lateinit var btnRegister: MaterialButton
    private lateinit var tvLogin: TextView

    private var loadingIndicator: CircularProgressIndicator? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.fragment_register)

        vm = ViewModelProvider(this, AuthViewModelFactory(this))[AuthViewModel::class.java]

        tilFirstName = findViewById(R.id.tilFirstName)
        tilLastName = findViewById(R.id.tilLastName)
        tilEmail = findViewById(R.id.tilEmail)
        tilPhone = findViewById(R.id.tilPhone)
        tilPassword = findViewById(R.id.tilPassword)
        tilConfirmPassword = findViewById(R.id.tilConfirmPassword)
        btnRegister = findViewById(R.id.btnRegister)
        tvLogin = findViewById(R.id.tvLogin)
        loadingIndicator = findViewById<View?>(R.id.loadingIndicator) as? CircularProgressIndicator

        btnRegister.setOnClickListener { onRegisterClick() }
        tvLogin.setOnClickListener { finish() }

        observeUiState()
    }

    private fun onRegisterClick() {
        val firstName = tilFirstName.editText?.text?.toString()?.trim().orEmpty()
        val lastName = tilLastName.editText?.text?.toString()?.trim().orEmpty()
        val email = tilEmail.editText?.text?.toString()?.trim().orEmpty()
        val phone = tilPhone.editText?.text?.toString()?.trim().orEmpty()
        val password = tilPassword.editText?.text?.toString().orEmpty()
        val confirm = tilConfirmPassword.editText?.text?.toString().orEmpty()

        tilFirstName.error = null
        tilLastName.error = null
        tilEmail.error = null
        tilPhone.error = null
        tilPassword.error = null
        tilConfirmPassword.error = null

        if (firstName.isEmpty()) {
            tilFirstName.error = "Enter first name"
            return
        }
        if (lastName.isEmpty()) {
            tilLastName.error = "Enter last name"
            return
        }
        if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            tilEmail.error = "Enter a valid email"
            return
        }
        if (phone.length < 10) {
            tilPhone.error = "Enter valid phone number"
            return
        }
        if (password.length < 6) {
            tilPassword.error = "Password must be at least 6 characters"
            return
        }
        if (password != confirm) {
            tilConfirmPassword.error = "Passwords do not match"
            return
        }

        vm.register(
            email = email,
            password = password,
            firstName = firstName,
            lastName = lastName,
            dob = null,
            gender = null
        )
    }

    private fun observeUiState() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                vm.uiState.collect { state ->
                    loadingIndicator?.visibility = if (state.loading) View.VISIBLE else View.GONE
                    btnRegister.isEnabled = !state.loading

                    state.errorMessage?.let {
                        AppCenterToast.error(this@RegisterActivity, it)
                        vm.clearMessages()
                    }

                    state.successMessage?.let {
                        AppCenterToast.success(this@RegisterActivity, it)
                        vm.clearMessages()
                        finish()
                    }
                }
            }
        }
    }
}
