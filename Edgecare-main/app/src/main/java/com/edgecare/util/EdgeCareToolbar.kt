package com.edgecare.util

import android.view.Gravity
import android.view.LayoutInflater
import androidx.appcompat.widget.Toolbar
import com.edgecare.R
import android.widget.TextView

object EdgeCareToolbar {

    fun bind(
        toolbar: Toolbar,
        subtitle: String,
        title: String = "EdgeCare",
        showNavigation: Boolean = false,
        onNavigationClick: (() -> Unit)? = null
    ) {
        toolbar.title = ""
        toolbar.subtitle = ""
        toolbar.removeAllViews()

        val content = LayoutInflater.from(toolbar.context)
            .inflate(R.layout.view_edgecare_toolbar_content, toolbar, false)

        content.findViewById<TextView>(R.id.tvToolbarTitle).text = title
        content.findViewById<TextView>(R.id.tvToolbarSubtitle).text = subtitle

        toolbar.addView(
            content,
            Toolbar.LayoutParams(
                Toolbar.LayoutParams.WRAP_CONTENT,
                Toolbar.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.START or Gravity.CENTER_VERTICAL
                marginStart = if (showNavigation) 4 else 0
            }
        )

        if (showNavigation) {
            toolbar.navigationIcon = toolbar.context.getDrawable(R.drawable.ic_arrow_back)
            toolbar.setNavigationOnClickListener { onNavigationClick?.invoke() }
        } else {
            toolbar.navigationIcon = null
            toolbar.setNavigationOnClickListener(null)
        }
    }
}
