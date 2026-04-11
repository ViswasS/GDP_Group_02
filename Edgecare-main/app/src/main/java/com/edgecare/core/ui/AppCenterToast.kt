package com.edgecare.core.ui

import android.content.Context
import android.view.Gravity
import android.view.LayoutInflater
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import com.edgecare.R

object AppCenterToast {

    enum class Type {
        SUCCESS, ERROR, INFO
    }

    fun success(context: Context, message: String, duration: Int = Toast.LENGTH_SHORT) {
        show(context, message, Type.SUCCESS, duration)
    }

    fun error(context: Context, message: String, duration: Int = Toast.LENGTH_SHORT) {
        show(context, message, Type.ERROR, duration)
    }

    fun info(context: Context, message: String, duration: Int = Toast.LENGTH_SHORT) {
        show(context, message, Type.INFO, duration)
    }

    private fun show(context: Context, message: String, type: Type, duration: Int) {
        val inflater = LayoutInflater.from(context)
        val layout = inflater.inflate(R.layout.view_center_toast, null)

        val root = layout.findViewById<LinearLayout>(R.id.ll_toast_root)
        val textView = layout.findViewById<TextView>(R.id.tv_toast_message)
        val imageView = layout.findViewById<ImageView>(R.id.iv_toast_icon)

        textView.text = message

        when (type) {
            Type.SUCCESS -> {
                textView.setTextColor(context.getColor(R.color.notice_success))
            }
            Type.ERROR -> {
                textView.setTextColor(context.getColor(R.color.notice_error))
            }
            Type.INFO -> {
                textView.setTextColor(context.getColor(R.color.notice_info))
            }
        }

        with(Toast(context.applicationContext)) {
            setGravity(Gravity.CENTER, 0, 0)
            this.duration = duration
            view = layout
            show()
        }
    }
}
