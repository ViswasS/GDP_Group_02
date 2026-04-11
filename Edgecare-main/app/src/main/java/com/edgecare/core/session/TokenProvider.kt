package com.edgecare.core.session

interface TokenProvider {
    fun getAccessTokenBlocking(): String?
    fun clearSessionBlocking()
}
