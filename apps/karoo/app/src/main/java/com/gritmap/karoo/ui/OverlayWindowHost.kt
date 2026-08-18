package com.gritmap.karoo.ui

import android.content.Context
import android.graphics.PixelFormat
import android.provider.Settings
import android.view.Gravity
import android.view.WindowManager
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.platform.ComposeView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeViewModelStoreOwner
import androidx.savedstate.SavedStateRegistry
import androidx.savedstate.SavedStateRegistryController
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import com.gritmap.karoo.ui.state.LiveUiState

class OverlayWindowHost(context: Context) {
    private val appContext = context.applicationContext
    private val windowManager = appContext.getSystemService(WindowManager::class.java)
    private var lifecycleOwner: OverlayLifecycleOwner? = null
    private var overlay: ComposeView? = null
    private val overlayState = mutableStateOf(LiveUiState.Idle)

    val layoutParams: WindowManager.LayoutParams
        get() = createLayoutParams()

    fun show(state: LiveUiState): Boolean {
        if (!Settings.canDrawOverlays(appContext)) return false
        overlayState.value = state
        val view = overlay ?: ComposeView(appContext).also {
            val owner = OverlayLifecycleOwner().also(OverlayLifecycleOwner::attach)
            lifecycleOwner = owner
            it.setViewTreeLifecycleOwner(owner)
            it.setViewTreeSavedStateRegistryOwner(owner)
            it.setViewTreeViewModelStoreOwner(owner)
            it.setContent { LivePacingOverlay(overlayState.value) }
            windowManager.addView(it, createLayoutParams())
            overlay = it
        }
        view.invalidate()
        return true
    }

    fun hide() {
        overlay?.let {
            windowManager.removeView(it)
            it.disposeComposition()
        }
        overlay = null
        lifecycleOwner?.detach()
        lifecycleOwner = null
    }

    companion object {
        fun createLayoutParams(): WindowManager.LayoutParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
        }
    }
}

private class OverlayLifecycleOwner : LifecycleOwner, SavedStateRegistryOwner, ViewModelStoreOwner {
    private val registry = LifecycleRegistry(this)
    private val savedStateController = SavedStateRegistryController.create(this)
    override val lifecycle: Lifecycle = registry
    override val savedStateRegistry: SavedStateRegistry = savedStateController.savedStateRegistry
    override val viewModelStore = ViewModelStore()
    private var attached = false

    fun attach() {
        check(!attached) { "Overlay lifecycle owner is already attached" }
        savedStateController.performAttach()
        savedStateController.performRestore(null)
        registry.currentState = Lifecycle.State.CREATED
        registry.currentState = Lifecycle.State.STARTED
        registry.currentState = Lifecycle.State.RESUMED
        attached = true
    }

    fun detach() {
        if (!attached) return
        registry.currentState = Lifecycle.State.DESTROYED
        viewModelStore.clear()
        attached = false
    }
}
