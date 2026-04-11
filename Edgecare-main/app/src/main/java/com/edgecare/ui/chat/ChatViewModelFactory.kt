package com.edgecare.ui.chat

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.edgecare.core.network.ConnectivityObserver
import com.edgecare.core.remote.EdgeCareApiClient
import com.edgecare.core.session.DataStoreTokenProvider
import com.edgecare.core.session.SessionStore
import com.edgecare.data.remote.api.CasesApi
import com.edgecare.data.repository.CasesRepository
import com.edgecare.data.repository.ChatRepository

class ChatViewModelFactory(
    private val context: Context,
    private val caseId: Long
) : ViewModelProvider.Factory {

    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        val sessionStore = SessionStore(context)
        val tokenProvider = DataStoreTokenProvider(sessionStore)
        val retrofit = EdgeCareApiClient.create(tokenProvider)
        val api = retrofit.create(CasesApi::class.java)
        val casesRepository = CasesRepository(api)
        val connectivityObserver = ConnectivityObserver(context)

        return ChatViewModel(
            caseId = caseId,
            chatRepository = ChatRepository(casesRepository, kotlinx.coroutines.MainScope()),
            sessionStore = sessionStore,
            connectivityObserver = connectivityObserver
        ) as T
    }
}
