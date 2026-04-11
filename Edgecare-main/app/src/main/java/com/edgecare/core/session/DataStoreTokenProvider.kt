package com.edgecare.core.session

import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

class DataStoreTokenProvider(
    private val sessionStore: SessionStore
) : TokenProvider {

    override fun getAccessTokenBlocking(): String? = runBlocking {
        sessionStore.accessToken.first()
    }

    override fun clearSessionBlocking() = runBlocking {
        sessionStore.clear()
    }
}
