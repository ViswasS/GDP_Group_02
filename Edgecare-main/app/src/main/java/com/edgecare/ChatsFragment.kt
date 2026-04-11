package com.edgecare

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ProgressBar
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
import com.edgecare.data.remote.api.CasesApi
import com.edgecare.data.repository.CasesRepository
import com.edgecare.ui.chats.ChatThreadsAdapter
import com.edgecare.util.EdgeCareToolbar
import com.google.android.material.appbar.MaterialToolbar
import kotlinx.coroutines.launch

class ChatsFragment : Fragment() {

    private lateinit var rvChatThreads: RecyclerView
    private lateinit var layoutEmpty: View
    private lateinit var progressBar: ProgressBar
    private lateinit var toolbar: MaterialToolbar
    private lateinit var adapter: ChatThreadsAdapter
    
    private lateinit var repository: CasesRepository
    private lateinit var connectivityObserver: ConnectivityObserver
    private var isOnline = true

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_chats, container, false)
        setupInsets(view)
        return view
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupViews(view)
        
        val sessionStore = SessionStore(requireContext())
        val api = EdgeCareApiClient.create(DataStoreTokenProvider(sessionStore))
            .create(CasesApi::class.java)
        repository = CasesRepository(api)
        connectivityObserver = ConnectivityObserver(requireContext())
        
        setupRecyclerView()
        observeConnectivity()
        loadThreads()
    }

    private fun setupViews(view: View) {
        rvChatThreads = view.findViewById(R.id.rvChatThreads)
        layoutEmpty = view.findViewById(R.id.layoutEmpty)
        progressBar = view.findViewById(R.id.progressBar)
        toolbar = view.findViewById(R.id.toolbar)

        EdgeCareToolbar.bind(toolbar, subtitle = "Messages")
    }

    private fun setupInsets(view: View) {
        ViewCompat.setOnApplyWindowInsetsListener(view) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(v.paddingLeft, systemBars.top, v.paddingRight, systemBars.bottom)
            insets
        }
    }

    private fun setupRecyclerView() {
        adapter = ChatThreadsAdapter { case ->
            val action = ChatsFragmentDirections.actionChatsToChatFragment(case.id)
            findNavController().navigate(action)
        }
        rvChatThreads.layoutManager = LinearLayoutManager(context)
        rvChatThreads.adapter = adapter
    }

    private fun observeConnectivity() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                connectivityObserver.networkAvailable.collect { online ->
                    isOnline = online
                    if (online) loadThreads()
                }
            }
        }
    }

    private fun loadThreads() {
        if (!isOnline) return
        
        progressBar.visibility = View.VISIBLE
        viewLifecycleOwner.lifecycleScope.launch {
            repository.fetchCases().onSuccess { cases ->
                adapter.submitList(cases)
                layoutEmpty.visibility = if (cases.isEmpty()) View.VISIBLE else View.GONE
            }.onFailure {
                // Handle error
            }
            progressBar.visibility = View.GONE
        }
    }
}
