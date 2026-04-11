package com.edgecare.core.session

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "edgecare_session")

class SessionStore(private val context: Context) {

    private val KEY_ACCESS_TOKEN = stringPreferencesKey("access_token")
    private val KEY_REFRESH_TOKEN = stringPreferencesKey("refresh_token")
    private val KEY_USER_EMAIL = stringPreferencesKey("user_email")
    private val KEY_DISPLAY_NAME = stringPreferencesKey("display_name")
    private val KEY_USER_ID = longPreferencesKey("user_id")

    val accessToken: Flow<String?> = context.dataStore.data.map { it[KEY_ACCESS_TOKEN] }
    val refreshToken: Flow<String?> = context.dataStore.data.map { it[KEY_REFRESH_TOKEN] }
    val userEmail: Flow<String?> = context.dataStore.data.map { it[KEY_USER_EMAIL] }
    val displayName: Flow<String?> = context.dataStore.data.map { it[KEY_DISPLAY_NAME] }
    val userId: Flow<Long?> = context.dataStore.data.map { it[KEY_USER_ID] }

    suspend fun saveSession(accessToken: String?, refreshToken: String?, email: String?) {
        context.dataStore.edit { prefs ->
            if (accessToken != null) prefs[KEY_ACCESS_TOKEN] = accessToken else prefs.remove(KEY_ACCESS_TOKEN)
            if (refreshToken != null) prefs[KEY_REFRESH_TOKEN] = refreshToken else prefs.remove(KEY_REFRESH_TOKEN)
            if (email != null) prefs[KEY_USER_EMAIL] = email else prefs.remove(KEY_USER_EMAIL)
        }
    }

    suspend fun saveUserId(id: Long?) {
        context.dataStore.edit { prefs ->
            if (id != null) prefs[KEY_USER_ID] = id else prefs.remove(KEY_USER_ID)
        }
    }

    suspend fun saveDisplayName(name: String?) {
        context.dataStore.edit { prefs ->
            if (name != null) prefs[KEY_DISPLAY_NAME] = name else prefs.remove(KEY_DISPLAY_NAME)
        }
    }

    suspend fun clear() {
        context.dataStore.edit { it.clear() }
    }
}
