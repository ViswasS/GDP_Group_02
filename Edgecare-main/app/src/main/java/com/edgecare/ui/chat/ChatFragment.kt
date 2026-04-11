package com.edgecare.ui.chat

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.ImageButton
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.widget.Toolbar
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.edgecare.R
import com.edgecare.util.EdgeCareToolbar
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.launch

class ChatFragment : Fragment() {

    private var caseId: Int = -1
    private var doctorName: String? = null

    private val viewModel: ChatViewModel by viewModels {
        ChatViewModelFactory(requireContext(), caseId.toLong())
    }

    private lateinit var rvMessages: RecyclerView
    private lateinit var etMessage: EditText
    private lateinit var btnSend: ImageButton
    private lateinit var btnLoadOlder: MaterialButton
    private lateinit var viewOnlineStatus: View
    private lateinit var layoutAiPending: View
    private lateinit var tvAiPending: TextView
    private lateinit var tvChatState: TextView
    private lateinit var adapter: ChatAdapter
    private lateinit var progressBar: ProgressBar

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        caseId = arguments?.getInt("caseId") ?: -1
        doctorName = arguments?.getString("doctorName")
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.fragment_chat, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupInsets(view)

        rvMessages = view.findViewById(R.id.rvMessages)
        etMessage = view.findViewById(R.id.etMessage)
        btnSend = view.findViewById(R.id.btnSend)
        btnLoadOlder = view.findViewById(R.id.btnLoadOlder)
        viewOnlineStatus = view.findViewById(R.id.viewOnlineStatus)
        layoutAiPending = view.findViewById(R.id.layoutAiPending)
        tvAiPending = view.findViewById(R.id.tvAiPending)
        tvChatState = view.findViewById(R.id.tvChatState)
        progressBar = view.findViewById(R.id.progressBar)

        val toolbar = view.findViewById<Toolbar>(R.id.toolbar)
        EdgeCareToolbar.bind(
            toolbar = toolbar,
            subtitle = if (!doctorName.isNullOrBlank()) {
                "Case #$caseId doctor and AI chat"
            } else {
                "Case #$caseId AI support"
            },
            showNavigation = true,
            onNavigationClick = { findNavController().navigateUp() }
        )

        setupRecyclerView()
        observeViewModel()

        btnSend.setOnClickListener { handleSend() }
        btnLoadOlder.setOnClickListener { viewModel.loadOlderMessages() }
        etMessage.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
            override fun afterTextChanged(s: Editable?) {
                refreshSendState()
            }
        })
        refreshSendState()
    }

    private fun setupInsets(view: View) {
        ViewCompat.setOnApplyWindowInsetsListener(view) { target, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            target.setPadding(target.paddingLeft, systemBars.top, target.paddingRight, systemBars.bottom)
            insets
        }
    }

    private fun handleSend() {
        val content = etMessage.text.toString().trim()
        if (content.isBlank()) return

        if (!viewModel.isOnline.value) {
            Toast.makeText(context, "You appear to be offline", Toast.LENGTH_SHORT).show()
            return
        }

        viewModel.sendMessage(content)
        etMessage.text.clear()
        refreshSendState()
    }

    private fun setupRecyclerView() {
        adapter = ChatAdapter(0L)
        rvMessages.adapter = adapter
        rvMessages.layoutManager = LinearLayoutManager(context).apply { stackFromEnd = true }

        adapter.registerAdapterDataObserver(object : RecyclerView.AdapterDataObserver() {
            override fun onItemRangeInserted(positionStart: Int, itemCount: Int) {
                rvMessages.scrollToPosition(adapter.itemCount - 1)
            }
        })
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch {
                    viewModel.currentUserId.collect { userId ->
                        if (userId != null) adapter.updateCurrentUserId(userId)
                    }
                }

                launch {
                    viewModel.messages.collect { messages ->
                        adapter.submitList(messages)
                        progressBar.isVisible = false
                        tvChatState.isVisible = messages.isEmpty() && !viewModel.isLoadingHistory.value
                        tvChatState.text = if (messages.isEmpty()) {
                            "No messages yet. Ask AI support a question about this case."
                        } else {
                            ""
                        }
                    }
                }

                launch {
                    viewModel.isOnline.collect { isOnline ->
                        viewOnlineStatus.setBackgroundResource(
                            if (isOnline) R.drawable.bg_status_online else R.drawable.bg_status_offline
                        )
                        refreshSendState()
                    }
                }

                launch {
                    viewModel.isSending.collect {
                        refreshSendState()
                    }
                }

                launch {
                    viewModel.isAwaitingAiReply.collect { awaiting ->
                        layoutAiPending.isVisible = awaiting
                        tvAiPending.text = if (awaiting) {
                            "AI Support is reviewing the latest case update..."
                        } else {
                            ""
                        }
                    }
                }

                launch {
                    viewModel.isLoadingHistory.collect { loading ->
                        progressBar.isVisible = loading && adapter.itemCount == 0
                        if (loading && adapter.itemCount == 0) {
                            tvChatState.isVisible = true
                            tvChatState.text = "Loading conversation..."
                        }
                    }
                }

                launch {
                    viewModel.hasMoreHistory.collect { hasMore ->
                        btnLoadOlder.isVisible = hasMore
                    }
                }

                launch {
                    viewModel.chatErrors.collect { message ->
                        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
    }

    private fun refreshSendState() {
        btnSend.isEnabled = viewModel.isOnline.value && !viewModel.isSending.value &&
            etMessage.text.toString().trim().isNotBlank()
        btnLoadOlder.isEnabled = !viewModel.isLoadingHistory.value
    }
}
