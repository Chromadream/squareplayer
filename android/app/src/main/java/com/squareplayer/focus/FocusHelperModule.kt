package com.squareplayer.focus

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.UIManagerHelper

class FocusHelperModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "FocusHelper"

    @ReactMethod
    fun requestFocus(reactTag: Double) {
        val tag = reactTag.toInt()
        UiThreadUtil.runOnUiThread {
            try {
                val uiManager = UIManagerHelper.getUIManager(reactContext, tag)
                val view = uiManager?.resolveView(tag)
                view?.requestFocus()
            } catch (e: Exception) {
                // View may have been unmounted — ignore silently
            }
        }
    }
}
