package com.edgecare.core.remote

import com.edgecare.BuildConfig
import com.edgecare.core.session.TokenProvider
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object EdgeCareApiClient {

    fun provideOkHttpClient(tokenProvider: TokenProvider): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        return OkHttpClient.Builder()
            .addInterceptor(logging)
            .addInterceptor(AuthInterceptor(tokenProvider))
            .build()
    }

    fun create(tokenProvider: TokenProvider): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BuildConfig.BASE_URL.trimEnd('/') + "/")
            .client(provideOkHttpClient(tokenProvider))
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    fun provideMlOkHttpClient(tokenProvider: TokenProvider): OkHttpClient {
        return provideOkHttpClient(tokenProvider).newBuilder()
            .connectTimeout(60, TimeUnit.SECONDS)
            .readTimeout(90, TimeUnit.SECONDS)
            .writeTimeout(90, TimeUnit.SECONDS)
            .callTimeout(120, TimeUnit.SECONDS)
            .build()
    }
}
