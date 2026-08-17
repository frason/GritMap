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
import androidx.lifecycle.setViewTreeLifecycleOwner
import com.gritmap.karoo.ui.state.LiveUiState

class OverlayWindowHost(context: Context) {
    private val appContext = context.applicationContext
    private val windowManager = appContext.getSystemService(WindowManager::class.java)
    private var lifecycleOwner = OverlayLifecycleOwner()
    private var overlay: ComposeView? = null
    private val overlayState = mutableStateOf(LiveUiState.Idle)

    val layoutParams: WindowManager.LayoutParams
        get() = createLayoutParams()

    fun show(state: LiveUiState): Boolean {
        if (!Settings.canDrawOverlays(appContext)) return false
        overlayState.value = state
        val view = overlay ?: ComposeView(appContext).also {
            lifecycleOwner = OverlayLifecycleOwner()
            it.setViewTreeLifecycleOwner(lifecycleOwner)
            lifecycleOwner.attach()
            windowManager.addView(it, createLayoutParams())
            it.setContent { LivePacingOverlay(overlayState.value) }
            overlay = it
        }
        view.invalidate()
        return true
    }

    fun hide() {
        overlay?.let { windowManager.removeView(it) }
        overlay = null
        lifecycleOwner.detach()
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

private class OverlayLifecycleOwner : LifecycleOwner {
    private val registry = LifecycleRegistry(this)
    override val lifecycle: Lifecycle = registry

    fun attach() {
        registry.currentState = Lifecycle.State.CREATED
        registry.currentState = Lifecycle.State.STARTED
        registry.currentState = Lifecycle.State.RESUMED
    }

    fun detach() {
        registry.currentState = Lifecycle.State.DESTROYED
    }
}
