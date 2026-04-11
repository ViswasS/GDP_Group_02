package com.edgecare.ui.chat

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.edgecare.core.network.ConnectivityObserver
import com.edgecare.core.session.SessionStore
import com.edgecare.data.remote.dto.ChatMessageDto
import com.edgecare.data.repository.ChatRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class ChatViewModel(
    private val caseId: Long,
    private val chatRepository: ChatRepository,
    private val sessionStore: SessionStore,
    connectivityObserver: ConnectivityObserver
) : ViewModel() {

    private val _currentUserId = MutableStateFlow<Long?>(null)
    val currentUserId: StateFlow<Long?> = _currentUserId

    val messages: StateFlow<List<ChatMessageDto>> = chatRepository.messages
    val isSending = chatRepository.isSending
    val isLoadingHistory = chatRepository.isLoadingHistory
    val isAwaitingAiReply = chatRepository.isAwaitingAiReply
    val hasMoreHistory = chatRepository.hasMoreHistory
    val chatErrors = chatRepository.errors

    private val logTag = "ChatViewModel"

    val isOnline: StateFlow<Boolean> = connectivityObserver.networkAvailable
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    init {
        loadData()
    }

    private fun loadData() {
        viewModelScope.launch {
            chatRepository.setActiveCase(caseId)
            _currentUserId.value = sessionStore.userId.first()
            chatRepository.loadInitial(caseId)
        }
    }

    fun loadOlderMessages() {
        viewModelScope.launch {
            chatRepository.loadOlderMessages()
        }
    }

    fun sendMessage(content: String) {
        if (content.isBlank()) return

        val userId = _currentUserId.value
        if (userId == null) {
            viewModelScope.launch {
                val stored = sessionStore.userId.first()
                _currentUserId.value = stored
                if (stored != null) {
                    chatRepository.sendMessage(caseId, content, stored)
                } else {
                    Log.e(logTag, "[caseId=$caseId] event=send_user_id_missing")
                }
            }
            return
        }

        chatRepository.sendMessage(caseId, content, userId)
    }
}
