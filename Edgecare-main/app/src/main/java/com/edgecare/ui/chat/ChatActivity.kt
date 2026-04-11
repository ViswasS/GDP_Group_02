package com.edgecare.ui.chat

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.isVisible
import androidx.core.view.updatePadding
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.edgecare.R
import com.edgecare.core.remote.EdgeCareApiClient
import com.edgecare.core.session.DataStoreTokenProvider
import com.edgecare.core.session.SessionStore
import com.edgecare.data.remote.dto.ChatMessageDto
import com.edgecare.data.repository.ChatRepository
import com.edgecare.databinding.ActivityChatBinding
import com.edgecare.util.CaseStatusMapper
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class ChatActivity : AppCompatActivity() {

    private lateinit var binding: ActivityChatBinding
    private val messageAdapter = MessageAdapter()
    private lateinit var chatRepository: ChatRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityChatBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupInsets()
        
        val caseId = intent.getIntExtra("caseId", -1)
        if (caseId == -1) {
            Toast.makeText(this, "Error: Case ID missing", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        val caseNumber = intent.getIntExtra("caseNumber", caseId)
        val doctorName = intent.getStringExtra("doctorName")
        val caseTitle = intent.getStringExtra("caseTitle") ?: "Case Detail"
        val status = intent.getStringExtra("status")

        val sessionStore = SessionStore(this)
        val api = EdgeCareApiClient.create(DataStoreTokenProvider(sessionStore))
        // chatRepository = ChatRepository(api) // Assuming ChatRepository exists

        setupToolbar(caseNumber, doctorName, status)
        setupRecyclerView()
        setupInputBar()
        
        loadMessages(caseId)
    }

    private fun setupInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(binding.rootChat) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.updatePadding(top = systemBars.top, bottom = systemBars.bottom)
            insets
        }
    }

    private fun setupToolbar(caseNumber: Int, doctorName: String?, status: String?) {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowTitleEnabled(false)

        binding.toolbarTitle.text = "Case #$caseNumber"
        
        binding.toolbarSubtitle.text = if (!doctorName.isNullOrBlank()) {
            "Dr. $doctorName • Online"
        } else {
            CaseStatusMapper.mapStatus(status)
        }

        if (status != null) {
            binding.toolbarStatusChip.isVisible = true
            binding.toolbarStatusChip.text = CaseStatusMapper.mapStatus(status).uppercase()
            updateStatusChipColors(status)
        }

        binding.toolbar.setNavigationOnClickListener {
            finish()
        }
    }

    private fun updateStatusChipColors(status: String) {
        binding.toolbarStatusChip.setChipBackgroundColorResource(CaseStatusMapper.getStatusBackgroundRes(status))
        binding.toolbarStatusChip.setTextColor(CaseStatusMapper.getStatusColor(this, status))
    }

    private fun setupRecyclerView() {
        binding.rvMessages.apply {
            layoutManager = LinearLayoutManager(this@ChatActivity).apply {
                stackFromEnd = true
            }
            adapter = messageAdapter
        }
    }

    private fun loadMessages(caseId: Int) {
        binding.progressBar.isVisible = true
        binding.tvEmptyState.isVisible = false
        
        lifecycleScope.launch {
            // TODO: Implement actual message fetching via chatRepository
            // For now, demonstrating with fake list after delay
            delay(1000) 
            
            val mockMessages = listOf<ChatMessageDto>() // Empty for demo
            
            binding.progressBar.isVisible = false
            if (mockMessages.isEmpty()) {
                binding.tvEmptyState.isVisible = true
            } else {
                messageAdapter.submitList(mockMessages)
                binding.rvMessages.scrollToPosition(mockMessages.size - 1)
            }
        }
    }

    private fun setupInputBar() {
        binding.btnSend.setOnClickListener {
            val text = binding.etMessage.text.toString().trim()
            if (text.isNotEmpty()) {
                // sendMessage(text)
                binding.etMessage.text.clear()
            }
        }
    }
}
