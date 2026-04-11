package com.edgecare

import android.content.Intent
import android.os.Bundle
import android.util.Patterns
import android.view.View
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.edgecare.ui.auth.AuthViewModel
import com.edgecare.ui.auth.AuthViewModelFactory
import com.google.android.material.button.MaterialButton
import com.google.android.material.progressindicator.CircularProgressIndicator
import com.google.android.material.textfield.TextInputLayout
import kotlinx.coroutines.launch
import androidx.lifecycle.Lifecycle
import com.edgecare.core.ui.AppCenterToast

class LoginActivity : ComponentActivity() {

    private lateinit var vm: AuthViewModel

    private lateinit var tilEmail: TextInputLayout
    private lateinit var tilPassword: TextInputLayout
    private lateinit var btnLogin: MaterialButton
    private lateinit var tvSignUp: TextView

    // Optional in XML. If not present, code still works.
    private var loadingIndicator: CircularProgressIndicator? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.fragment_login)

        vm = ViewModelProvider(this, AuthViewModelFactory(this))[AuthViewModel::class.java]

        tilEmail = findViewById(R.id.tilEmail)
        tilPassword = findViewById(R.id.tilPassword)
        btnLogin = findViewById(R.id.btnLogin)
        tvSignUp = findViewById(R.id.tvSignUp)
        loadingIndicator = findViewById<View?>(R.id.loadingIndicator) as? CircularProgressIndicator

        btnLogin.setOnClickListener { onLoginClick() }
        tvSignUp.setOnClickListener { startActivity(Intent(this, RegisterActivity::class.java)) }

        observeUiState()
    }

    private fun onLoginClick() {
        val email = tilEmail.editText?.text?.toString()?.trim().orEmpty()
        val password = tilPassword.editText?.text?.toString().orEmpty()

        tilEmail.error = null
        tilPassword.error = null

        if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            tilEmail.error = "Enter a valid email"
            return
        }
        if (password.length < 6) {
            tilPassword.error = "Password must be at least 6 characters"
            return
        }

        vm.login(email, password)
    }

    private fun observeUiState() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                vm.uiState.collect { state ->
                    loadingIndicator?.visibility = if (state.loading) View.VISIBLE else View.GONE
                    btnLogin.isEnabled = !state.loading

                    state.errorMessage?.let {
                        AppCenterToast.error(this@LoginActivity, it)
                        vm.clearMessages()
                    }

                    state.successMessage?.let {
                        AppCenterToast.success(this@LoginActivity, it)
                        vm.clearMessages()

                        startActivity(Intent(this@LoginActivity, MainActivity::class.java))
                        finish()
                    }
                }
            }
        }
    }
}
