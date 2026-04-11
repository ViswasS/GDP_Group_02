package com.edgecare.core.remote

import org.json.JSONObject

object ApiErrorParser {
    fun userMessage(errorBody: String?, fallback: String = "Something went wrong"): String {
        if (errorBody.isNullOrBlank()) return fallback
        return try {
            val jsonObject = JSONObject(errorBody)
            if (jsonObject.has("message")) {
                jsonObject.getString("message")
            } else if (jsonObject.has("error")) {
                jsonObject.getString("error")
            } else {
                fallback
            }
        } catch (e: Exception) {
            fallback
        }
    }
}
