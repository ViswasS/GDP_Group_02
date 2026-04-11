package com.edgecare.util

import android.content.Context
import androidx.annotation.ColorInt
import androidx.core.content.ContextCompat
import com.edgecare.R

object CaseStatusMapper {
    fun mapStatus(status: String?): String {
        return when (status?.uppercase()) {
            "IN_REVIEW" -> "In Review"
            "PENDING", "NEW", "OPEN" -> "Waiting for Doctor"
            "RESOLVED", "CLOSED" -> "Resolved"
            "REJECTED" -> "Rejected"
            else -> status ?: "Unknown"
        }
    }

    @ColorInt
    fun getStatusColor(context: Context, status: String?): Int {
        return when (status?.uppercase()) {
            "IN_REVIEW" -> ContextCompat.getColor(context, R.color.status_in_review_text)
            "PENDING", "NEW", "OPEN" -> ContextCompat.getColor(context, R.color.white)
            "RESOLVED", "CLOSED", "SUBMITTED" -> ContextCompat.getColor(context, R.color.status_closed_text)
            "REJECTED", "EMERGENCY" -> ContextCompat.getColor(context, R.color.status_emergency_text)
            else -> ContextCompat.getColor(context, R.color.status_emergency_text)
        }
    }

    fun getStatusBackgroundRes(status: String?): Int {
        return when (status?.uppercase()) {
            "IN_REVIEW" -> R.color.status_in_review_bg
            "RESOLVED", "CLOSED" -> R.color.status_closed_bg
            "REJECTED", "EMERGENCY" -> R.color.status_emergency_bg
            else -> android.R.color.transparent
        }
    }
}