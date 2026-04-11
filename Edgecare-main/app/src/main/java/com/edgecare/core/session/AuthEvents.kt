package com.edgecare.core.session

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow

object AuthEvents {
    private val _forceLogout = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val forceLogout = _forceLogout.asSharedFlow()

    fun triggerForceLogout() {
        _forceLogout.tryEmit(Unit)
    }
}
