package com.edgecare

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.view.isVisible
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.edgecare.data.remote.dto.CaseDto
import com.edgecare.util.CaseStatusMapper
import com.google.android.material.imageview.ShapeableImageView
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

class CaseAdapter(private val onCaseClick: (Int) -> Unit) :
    ListAdapter<CaseDto, CaseAdapter.CaseViewHolder>(CaseDiffCallback()) {

    class CaseViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val ivAvatar: ShapeableImageView = view.findViewById(R.id.ivAvatar)
        val tvTitle: TextView = view.findViewById(R.id.tvCaseTitle)
        val tvDate: TextView = view.findViewById(R.id.tvCaseDate)
        val tvDoctorName: TextView = view.findViewById(R.id.tvDoctorName)
        val tvPreview: TextView = view.findViewById(R.id.tvCasePreview)
        val tvStatusBadge: TextView = view.findViewById(R.id.tvStatusBadge)
        val unreadBadge: View = view.findViewById(R.id.unreadBadge)

        fun bind(item: CaseDto, onCaseClick: (Int) -> Unit) {
            tvTitle.text = item.intake?.title ?: "Untitled Case"
            tvDate.text = formatDate(item.submittedAt)
            
            val doctor = item.assignedDoctor
            val doctorName = if (doctor != null) {
                "Dr. ${doctor.firstName} ${doctor.lastName}"
            } else {
                CaseStatusMapper.mapStatus(item.status)
            }
            tvDoctorName.text = "Case #${item.id} • $doctorName"
            
            tvPreview.text = item.intake?.medications ?: "No preview available"
            
            tvStatusBadge.text = CaseStatusMapper.mapStatus(item.status)
            updateStatusBadgeColors(tvStatusBadge, item.status)
            
            unreadBadge.isVisible = item.status == "IN_REVIEW"

            itemView.setOnClickListener { onCaseClick(item.id) }
        }

        private fun updateStatusBadgeColors(textView: TextView, status: String?) {
            val context = textView.context
            textView.setBackgroundResource(CaseStatusMapper.getStatusBackgroundRes(status))
            textView.setTextColor(CaseStatusMapper.getStatusColor(context, status))
        }

        private fun formatDate(dateString: String): String {
            return try {
                val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
                inputFormat.timeZone = TimeZone.getTimeZone("UTC")
                val date = inputFormat.parse(dateString)
                val outputFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
                date?.let { outputFormat.format(it) } ?: dateString
            } catch (e: Exception) {
                dateString
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): CaseViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_case, parent, false)
        return CaseViewHolder(view)
    }

    override fun onBindViewHolder(holder: CaseViewHolder, position: Int) {
        holder.bind(getItem(position), onCaseClick)
    }

    class CaseDiffCallback : DiffUtil.ItemCallback<CaseDto>() {
        override fun areItemsTheSame(oldItem: CaseDto, newItem: CaseDto): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: CaseDto, newItem: CaseDto): Boolean {
            return oldItem == newItem
        }
    }
}
