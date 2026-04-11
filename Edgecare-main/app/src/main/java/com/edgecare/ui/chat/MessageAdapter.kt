package com.edgecare.ui.chat

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.view.isVisible
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.edgecare.R
import com.edgecare.data.remote.dto.ChatMessageDto
import com.google.android.material.imageview.ShapeableImageView
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit

class MessageAdapter : ListAdapter<ChatMessageDto, RecyclerView.ViewHolder>(MessageDiffCallback()) {

    companion object {
        private const val TYPE_PATIENT = 1
        private const val TYPE_DOCTOR = 2
    }

    override fun getItemViewType(position: Int): Int {
        val message = getItem(position)
        return if (message.senderRole.lowercase() == "patient") TYPE_PATIENT else TYPE_DOCTOR
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return if (viewType == TYPE_PATIENT) {
            PatientMessageViewHolder(inflater.inflate(R.layout.item_chat_message_patient, parent, false))
        } else {
            DoctorMessageViewHolder(inflater.inflate(R.layout.item_chat_message_doctor, parent, false))
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        val message = getItem(position)
        val prevMessage = if (position > 0) getItem(position - 1) else null
        
        val isFirstInGroup = prevMessage == null || 
                prevMessage.senderRole != message.senderRole ||
                isTimeGapSignificant(prevMessage.createdAt, message.createdAt)

        if (holder is PatientMessageViewHolder) {
            holder.bind(message, isFirstInGroup)
        } else if (holder is DoctorMessageViewHolder) {
            holder.bind(message, isFirstInGroup)
        }
    }

    private fun isTimeGapSignificant(time1: String?, time2: String?): Boolean {
        if (time1 == null || time2 == null) return true
        return try {
            val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
            val date1 = sdf.parse(time1)
            val date2 = sdf.parse(time2)
            if (date1 != null && date2 != null) {
                val diff = Math.abs(date2.time - date1.time)
                diff > TimeUnit.MINUTES.toMillis(2)
            } else true
        } catch (e: Exception) {
            true
        }
    }

    class PatientMessageViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val tvMessage: TextView = view.findViewById(R.id.tvMessage)
        private val tvTimestamp: TextView = view.findViewById(R.id.tvTimestamp)

        fun bind(message: ChatMessageDto, isFirstInGroup: Boolean) {
            tvMessage.text = message.content
            tvTimestamp.text = formatTimestamp(message.createdAt)
            
            val params = itemView.layoutParams as ViewGroup.MarginLayoutParams
            params.topMargin = if (isFirstInGroup) 12 else 2
            itemView.layoutParams = params
        }
    }

    class DoctorMessageViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val tvMessage: TextView = view.findViewById(R.id.tvMessage)
        private val tvTimestamp: TextView = view.findViewById(R.id.tvTimestamp)
        private val ivAvatar: ShapeableImageView = view.findViewById(R.id.ivDoctorAvatar)

        fun bind(message: ChatMessageDto, isFirstInGroup: Boolean) {
            tvMessage.text = message.content
            tvTimestamp.text = formatTimestamp(message.createdAt)
            
            ivAvatar.isVisible = isFirstInGroup
            
            val params = itemView.layoutParams as ViewGroup.MarginLayoutParams
            params.topMargin = if (isFirstInGroup) 12 else 2
            itemView.layoutParams = params
        }
    }

    class MessageDiffCallback : DiffUtil.ItemCallback<ChatMessageDto>() {
        override fun areItemsTheSame(oldItem: ChatMessageDto, newItem: ChatMessageDto): Boolean =
            oldItem.id == newItem.id || (oldItem.tempId != null && oldItem.tempId == newItem.tempId)

        override fun areContentsTheSame(oldItem: ChatMessageDto, newItem: ChatMessageDto): Boolean =
            oldItem == newItem
    }
}

private fun formatTimestamp(timestamp: String?): String {
    if (timestamp == null) return ""
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val date = inputFormat.parse(timestamp)
        val outputFormat = SimpleDateFormat("hh:mm a", Locale.getDefault())
        date?.let { outputFormat.format(it) } ?: ""
    } catch (e: Exception) {
        ""
    }
}
