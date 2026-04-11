package com.edgecare.core.network

import android.util.Log
import com.edgecare.BuildConfig
import com.edgecare.data.remote.dto.ChatMessageDto
import com.google.gson.Gson
import io.socket.client.Ack
import io.socket.client.IO
import io.socket.client.Manager
import io.socket.client.Socket
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONObject

object SocketManager {
    private const val TAG = "SocketManager"
    private var socket: Socket? = null
    private val gson = Gson()
    private var activeCaseId: Long? = null
    private var activeUserId: Long? = null
    private var lastToken: String? = null

    private val _incomingMessages = MutableSharedFlow<ChatMessageDto>(extraBufferCapacity = 100)
    val incomingMessages = _incomingMessages.asSharedFlow()

    private val _socketConnected = MutableStateFlow(false)
    val socketConnected = _socketConnected.asStateFlow()

    fun connect(token: String, userId: Long?) {
        activeUserId = userId
        if (socket != null && lastToken == token) {
            logDebug("socket_init_reuse", mapOf("reason" to "same_token"))
            if (socket?.connected() == false) {
                logDebug("socket_reconnect_trigger", mapOf("connected" to false))
                socket?.connect()
            }
            return
        }

        lastToken = token
        val cleanToken = token.removePrefix("Bearer ").trim()
        logDebug(
            "socket_connect_init",
            mapOf(
                "baseUrl" to BuildConfig.BASE_URL,
                "tokenPrefix" to cleanToken.take(10),
                "userId" to (activeUserId ?: "-"),
                "caseId" to (activeCaseId ?: "-")
            )
        )

        val options = IO.Options.builder()
            .setAuth(mapOf("token" to cleanToken))
            .build()

        socket?.disconnect()
        socket?.off()
        socket?.io()?.off()

        socket = IO.socket(BuildConfig.BASE_URL, options).apply {
            on(Socket.EVENT_CONNECT) {
                logDebug("socket_connected", mapOf("event" to Socket.EVENT_CONNECT, "connected" to (socket?.connected() == true)))
                _socketConnected.value = true
                activeCaseId?.let { joinCase(it) }
            }

            on(Socket.EVENT_DISCONNECT) {
                logDebug("socket_disconnected", mapOf("event" to Socket.EVENT_DISCONNECT))
                _socketConnected.value = false
            }

            on(Socket.EVENT_CONNECT_ERROR) { args ->
                logError(
                    "socket_connect_error",
                    mapOf(
                        "event" to Socket.EVENT_CONNECT_ERROR,
                        "error" to args.getOrNull(0)?.toString()
                    )
                )
            }

            io().on(Manager.EVENT_RECONNECT_ATTEMPT) { args ->
                logDebug(
                    "socket_reconnect_attempt",
                    mapOf(
                        "event" to Manager.EVENT_RECONNECT_ATTEMPT,
                        "attempt" to args.getOrNull(0)
                    )
                )
            }

            io().on(Manager.EVENT_RECONNECT) {
                logDebug(
                    "socket_reconnected",
                    mapOf(
                        "event" to Manager.EVENT_RECONNECT,
                        "connected" to (socket?.connected() == true)
                    )
                )
                _socketConnected.value = true
                activeCaseId?.let { joinCase(it) }
            }

            io().on(Manager.EVENT_RECONNECT_ERROR) { args ->
                logError(
                    "socket_reconnect_error",
                    mapOf(
                        "event" to Manager.EVENT_RECONNECT_ERROR,
                        "error" to args.getOrNull(0)?.toString()
                    )
                )
            }

            io().on(Manager.EVENT_RECONNECT_FAILED) {
                logError(
                    "socket_reconnect_failed",
                    mapOf("event" to Manager.EVENT_RECONNECT_FAILED)
                )
            }

            on("case:message:new") { args ->
                val data = args[0] as JSONObject
                logDebug(
                    "socket_incoming_message",
                    mapOf(
                        "event" to "case:message:new",
                        "payload" to data.toString(),
                        "conversationId" to (data.optLong("conversationId")),
                        "caseId" to data.optLong("caseId")
                    )
                )
                val message = gson.fromJson(data.toString(), ChatMessageDto::class.java)
                _incomingMessages.tryEmit(message)
            }

            connect()
        }
    }

    fun disconnect() {
        logDebug("socket_disconnect_request")
        socket?.disconnect()
        socket?.off()
        socket?.io()?.off()
        socket = null
        _socketConnected.value = false
        lastToken = null
        activeUserId = null
    }

    fun joinCase(caseId: Long) {
        logDebug("socket_join_case", mapOf("event" to "case:join", "caseId" to caseId))
        activeCaseId = caseId
        val data = JSONObject().apply {
            put("caseId", caseId.toInt()) // Backend often expects Int
        }
        // Fixed: Moved lambda inside parentheses and used explicit Ack interface
        socket?.emit("case:join", arrayOf(data), Ack { args ->
            logDebug(
                "socket_join_case_ack",
                mapOf("event" to "case:join", "ack" to args?.getOrNull(0)?.toString())
            )
        })
    }

    fun leaveCase(caseId: Long) {
        if (socket == null) return
        val payload = JSONObject().apply { put("caseId", caseId) }
        socket?.emit("case:leave", payload)
        logDebug("socket_leave_case", mapOf("caseId" to caseId))
    }

    fun switchToCase(caseId: Long) {
        val previous = activeCaseId
        if (previous != null && previous != caseId) {
            leaveCase(previous)
        }
        joinCase(caseId)
    }

    fun sendMessage(caseId: Long, tempId: String, content: String, onResult: (Boolean) -> Unit = {}) {
        val isConnected = socket?.connected() == true
        logDebug(
            "socket_emit_prepare",
            mapOf(
                "event" to "case:message:send",
                "connected" to isConnected,
                "caseId" to caseId,
                "tempId" to tempId,
                "contentLength" to content.length
            )
        )

        if (!isConnected) {
            logError(
                "socket_emit_blocked",
                mapOf(
                    "event" to "case:message:send",
                    "reason" to "disconnected"
                )
            )
            onResult(false)
            return
        }

        val data = JSONObject().apply {
            put("caseId", caseId.toInt())
            put("tempId", tempId)
            put("content", content)
        }
        
        logDebug(
            "socket_emit_payload",
            mapOf(
                "event" to "case:message:send",
                "payload" to data.toString(),
                "socketConnected" to isConnected
            )
        )

        // Fixed: Moved lambda inside parentheses and used explicit Ack interface
        socket?.emit("case:message:send", arrayOf(data), Ack { args ->
            val error = args?.getOrNull(0)
            if (error != null) {
                logError(
                    "socket_emit_ack_error",
                    mapOf(
                        "event" to "case:message:send",
                        "error" to error.toString(),
                        "tempId" to tempId,
                        "caseId" to caseId
                    )
                )
                onResult(false)
            } else {
                logDebug(
                    "socket_emit_ack_success",
                    mapOf(
                        "event" to "case:message:send",
                        "tempId" to tempId,
                        "caseId" to caseId
                    )
                )
                onResult(true)
            }
        })
    }

    private fun logDebug(event: String, extras: Map<String, Any?> = emptyMap()) {
        log(Log.DEBUG, event, extras)
    }

    private fun logError(event: String, extras: Map<String, Any?> = emptyMap()) {
        log(Log.ERROR, event, extras)
    }

    private fun log(level: Int, event: String, extras: Map<String, Any?>) {
        val timestamp = System.currentTimeMillis()
        val thread = Thread.currentThread().name
        val base = mutableListOf(
            "ts=$timestamp",
            "thread=$thread",
            "caseId=${activeCaseId ?: "-"}",
            "userId=${activeUserId ?: "-"}"
        )
        extras.forEach { (k, v) ->
            base.add("$k=${v ?: "-"}")
        }
        Log.println(level, TAG, "[${base.joinToString(",")}] event=$event")
    }
}
