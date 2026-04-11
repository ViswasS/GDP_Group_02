package com.edgecare.ui.cases

import android.net.Uri
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.ImageView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.edgecare.R
import com.google.android.material.progressindicator.CircularProgressIndicator

data class SelectedImage(
    val uri: Uri,
    var uploadUrl: String? = null,
    var isUploading: Boolean = false,
    var error: String? = null
)

class SelectedImageAdapter(
    private val onRemove: (SelectedImage) -> Unit
) : ListAdapter<SelectedImage, SelectedImageAdapter.ViewHolder>(DiffCallback) {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val ivThumbnail: ImageView = view.findViewById(R.id.ivThumbnail)
        val btnRemove: ImageButton = view.findViewById(R.id.btnRemove)
        val progressIndicator: CircularProgressIndicator = view.findViewById(R.id.progressIndicator)
        val viewOverlay: View = view.findViewById(R.id.viewOverlay)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_selected_image, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = getItem(position)
        holder.ivThumbnail.setImageURI(item.uri)
        
        holder.btnRemove.setOnClickListener { onRemove(item) }
        
        if (item.isUploading) {
            holder.progressIndicator.visibility = View.VISIBLE
            holder.viewOverlay.visibility = View.VISIBLE
        } else {
            holder.progressIndicator.visibility = View.GONE
            holder.viewOverlay.visibility = View.GONE
        }
    }

    companion object DiffCallback : DiffUtil.ItemCallback<SelectedImage>() {
        override fun areItemsTheSame(oldItem: SelectedImage, newItem: SelectedImage): Boolean {
            return oldItem.uri == newItem.uri
        }

        override fun areContentsTheSame(oldItem: SelectedImage, newItem: SelectedImage): Boolean {
            return oldItem == newItem
        }
    }
}
