package com.edgecare.ui.chat

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.edgecare.R
import com.edgecare.data.remote.dto.ChatMessageDto
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

class ChatAdapter(private var currentUserId: Long) :
    ListAdapter<ChatMessageDto, ChatAdapter.ChatViewHolder>(DiffCallback()) {

    companion object {
        private const val VIEW_TYPE_PATIENT = 1
        private const val VIEW_TYPE_OTHER = 2
        private const val VIEW_TYPE_AI = 3
        private const val VIEW_TYPE_SYSTEM = 4
    }

    fun updateCurrentUserId(userId: Long) {
        if (currentUserId != userId) {
            currentUserId = userId
            notifyDataSetChanged()
        }
    }

    override fun getItemViewType(position: Int): Int {
        val message = getItem(position)
        return when {
            isSystemMessage(message) -> VIEW_TYPE_SYSTEM
            isAiMessage(message) -> VIEW_TYPE_AI
            isPatientMessage(message) -> VIEW_TYPE_PATIENT
            else -> VIEW_TYPE_OTHER
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ChatViewHolder {
        val layout = when (viewType) {
            VIEW_TYPE_PATIENT -> R.layout.item_chat_self
            VIEW_TYPE_AI -> R.layout.item_chat_ai
            VIEW_TYPE_SYSTEM -> R.layout.item_chat_system
            else -> R.layout.item_chat_other
        }
        val view = LayoutInflater.from(parent.context).inflate(layout, parent, false)
        return ChatViewHolder(view)
    }

    override fun onBindViewHolder(holder: ChatViewHolder, position: Int) {
        holder.bind(getItem(position), currentUserId)
    }

    private fun isPatientMessage(message: ChatMessageDto): Boolean {
        return message.senderId == currentUserId || message.senderRole.equals("PATIENT", ignoreCase = true)
    }

    private fun isAiMessage(message: ChatMessageDto): Boolean {
        val type = message.messageType.orEmpty().uppercase(Locale.US)
        return message.senderRole.equals("AI", ignoreCase = true) ||
            type in setOf("AI_SUPPORT", "AI_SUMMARY", "AI_GUIDANCE")
    }

    private fun isSystemMessage(message: ChatMessageDto): Boolean {
        if (isAiMessage(message)) return false
        val type = message.messageType.orEmpty().uppercase(Locale.US)
        return message.senderRole.equals("SYSTEM", ignoreCase = true) ||
            type in setOf("DOCTOR_ASSIGNED", "DOCTOR_ASSIGNMENT_UNAVAILABLE", "IMAGE_REUPLOAD")
    }

    class ChatViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tvMessage: TextView = itemView.findViewById(R.id.tvMessage)
        private val tvTime: TextView = itemView.findViewById(R.id.tvTime)
        private val tvSender: TextView? = itemView.findViewById(R.id.tvSender)

        fun bind(message: ChatMessageDto, currentUserId: Long) {
            tvMessage.text = message.content
            tvTime.text = buildStatusText(message)
            tvSender?.text = senderLabel(message, currentUserId)
            itemView.alpha = if (message.pending) 0.7f else 1f
        }

        private fun senderLabel(message: ChatMessageDto, currentUserId: Long): String {
            return when {
                message.senderId == currentUserId || message.senderRole.equals("PATIENT", ignoreCase = true) -> "You"
                message.senderRole.equals("DOCTOR", ignoreCase = true) -> "Doctor"
                message.senderRole.equals("AI", ignoreCase = true) -> "AI Support"
                message.senderRole.equals("SYSTEM", ignoreCase = true) -> "System"
                message.messageType.equals("AI_SUPPORT", ignoreCase = true) -> "AI Support"
                else -> message.senderRole.ifBlank { "Support" }.replaceFirstChar { char ->
                    if (char.isLowerCase()) char.titlecase(Locale.US) else char.toString()
                }
            }
        }

        private fun buildStatusText(message: ChatMessageDto): String {
            val time = formatTime(message.createdAt)
            return when {
                message.failed -> "$time Failed"
                message.pending && isAiSupport(message) -> "$time Reviewing..."
                message.pending -> "$time Sending..."
                else -> time
            }.trim()
        }

        private fun isAiSupport(message: ChatMessageDto): Boolean {
            val type = message.messageType.orEmpty().uppercase(Locale.US)
            return message.senderRole.equals("AI", ignoreCase = true) ||
                type in setOf("AI_SUPPORT", "AI_SUMMARY", "AI_GUIDANCE")
        }

        private fun formatTime(timestamp: String?): String {
            if (timestamp.isNullOrBlank()) return ""
            return try {
                OffsetDateTime.parse(timestamp)
                    .format(DateTimeFormatter.ofPattern("HH:mm", Locale.getDefault()))
            } catch (_: Exception) {
                timestamp
            }
        }
    }

    class DiffCallback : DiffUtil.ItemCallback<ChatMessageDto>() {
        override fun areItemsTheSame(oldItem: ChatMessageDto, newItem: ChatMessageDto): Boolean {
            return (oldItem.id != null && oldItem.id == newItem.id) ||
                (oldItem.tempId != null && oldItem.tempId == newItem.tempId)
        }

        override fun areContentsTheSame(oldItem: ChatMessageDto, newItem: ChatMessageDto): Boolean {
            return oldItem == newItem
        }
    }
}
