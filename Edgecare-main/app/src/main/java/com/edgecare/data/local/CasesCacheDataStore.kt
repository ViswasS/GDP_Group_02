package com.edgecare.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.edgecare.data.remote.dto.CaseDto
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "cases_cache")

class CasesCacheDataStore(private val context: Context) {
    private val gson = Gson()

    companion object {
        private val CASES_LIST_JSON = stringPreferencesKey("cases_list_json")
        private val CASES_LAST_SYNC_AT = longPreferencesKey("cases_last_sync_at")
    }

    val cachedCasesFlow: Flow<List<CaseDto>> = context.dataStore.data.map { preferences ->
        val json = preferences[CASES_LIST_JSON] ?: "[]"
        val type = object : TypeToken<List<CaseDto>>() {}.type
        gson.fromJson(json, type)
    }

    suspend fun saveCases(list: List<CaseDto>) {
        context.dataStore.edit { preferences ->
            preferences[CASES_LIST_JSON] = gson.toJson(list)
            preferences[CASES_LAST_SYNC_AT] = System.currentTimeMillis()
        }
    }

    suspend fun clear() {
        context.dataStore.edit { preferences ->
            preferences.remove(CASES_LIST_JSON)
            preferences.remove(CASES_LAST_SYNC_AT)
        }
    }
}
