package com.edgecare

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.edgecare.core.network.ConnectivityObserver
import com.edgecare.core.remote.EdgeCareApiClient
import com.edgecare.core.session.DataStoreTokenProvider
import com.edgecare.core.session.SessionStore
import com.edgecare.data.local.CasesCacheDataStore
import com.edgecare.data.remote.api.CasesApi
import com.edgecare.data.repository.CasesRepository
import com.edgecare.util.EdgeCareToolbar
import com.google.android.material.card.MaterialCardView
import com.google.android.material.appbar.MaterialToolbar
import kotlinx.coroutines.launch

class HomeFragment : Fragment() {

    private lateinit var tvGreeting: TextView
    private lateinit var rvRecentCases: RecyclerView
    private lateinit var btnNavigateCreateCase: MaterialCardView
    private lateinit var layoutOffline: View
    private lateinit var toolbar: MaterialToolbar
    
    private lateinit var sessionStore: SessionStore
    private lateinit var repository: CasesRepository
    private lateinit var cache: CasesCacheDataStore
    private lateinit var connectivityObserver: ConnectivityObserver
    private lateinit var adapter: CaseAdapter
    
    private var isOnline = true

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_home, container, false)
        
        sessionStore = SessionStore(requireContext())
        cache = CasesCacheDataStore(requireContext())
        connectivityObserver = ConnectivityObserver(requireContext())
        
        val api = EdgeCareApiClient.create(DataStoreTokenProvider(sessionStore))
            .create(CasesApi::class.java)
        
        repository = CasesRepository(api)
        
        setupViews(view)
        setupInsets(view)
        setupRecyclerView()
        
        observeSession()
        observeConnectivity()
        observeCache()
        
        refreshData()
        
        return view
    }

    private fun setupViews(view: View) {
        tvGreeting = view.findViewById(R.id.tvGreeting)
        rvRecentCases = view.findViewById(R.id.rvRecentCases)
        btnNavigateCreateCase = view.findViewById(R.id.btnNavigateCreateCase)
        layoutOffline = view.findViewById(R.id.layoutOffline)
        toolbar = view.findViewById(R.id.toolbar)

        EdgeCareToolbar.bind(toolbar, subtitle = "Patient dashboard")

        btnNavigateCreateCase.setOnClickListener {
            findNavController().navigate(R.id.action_navigation_home_to_createCaseFragment)
        }
    }

    private fun setupInsets(view: View) {
        val root = view.findViewById<View>(R.id.rootHome)
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(v.paddingLeft, systemBars.top, v.paddingRight, systemBars.bottom)
            insets
        }
    }

    private fun observeSession() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                sessionStore.displayName.collect { name ->
                    tvGreeting.text = "Hello, ${name ?: "Patient"}"
                }
            }
        }
    }

    private fun observeConnectivity() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                connectivityObserver.networkAvailable.collect { online ->
                    isOnline = online
                    layoutOffline.visibility = if (online) View.GONE else View.VISIBLE
                    if (online) refreshData()
                }
            }
        }
    }

    private fun observeCache() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                cache.cachedCasesFlow.collect { cases ->
                    adapter.submitList(cases)
                }
            }
        }
    }

    private fun refreshData() {
        if (!isOnline) return
        
        viewLifecycleOwner.lifecycleScope.launch {
            repository.fetchCases().onSuccess { cases ->
                cache.saveCases(cases)
            }.onFailure {
                // Keep showing cache
            }
        }
    }

    private fun setupRecyclerView() {
        adapter = CaseAdapter { caseId ->
            val action = HomeFragmentDirections.actionHomeToCaseDetail(caseId)
            findNavController().navigate(action)
        }
        rvRecentCases.layoutManager = LinearLayoutManager(context)
        rvRecentCases.adapter = adapter
    }
}
