package com.squareplayer.materialyou

import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = MaterialYouModule.NAME)
class MaterialYouModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "MaterialYouColors"

        // Android tonal shade suffixes (0, 10, 50, 100..900, 1000)
        private val SHADES = intArrayOf(0, 10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000)

        // Color group prefixes
        private val GROUPS = arrayOf(
            "system_accent1",
            "system_accent2",
            "system_accent3",
            "system_neutral1",
            "system_neutral2",
        )
    }

    override fun getName(): String = NAME

    override fun getConstants(): MutableMap<String, Any> {
        val constants = mutableMapOf<String, Any>()
        constants["palette"] = buildPaletteMap()
        return constants
    }

    @ReactMethod
    fun getPalette(promise: Promise) {
        try {
            promise.resolve(buildPaletteMap())
        } catch (e: Exception) {
            promise.reject("MATERIAL_YOU_ERROR", "Failed to read Material You palette", e)
        }
    }

    private fun buildPaletteMap(): WritableMap {
        val context = reactApplicationContext
        val palette = Arguments.createMap()

        for (group in GROUPS) {
            val shadeArray = Arguments.createArray()
            for (shade in SHADES) {
                val resName = "${group}_$shade"
                val resId = context.resources.getIdentifier(resName, "color", "android")
                if (resId != 0) {
                    val color = ContextCompat.getColor(context, resId)
                    // Convert to #RRGGBB hex string
                    shadeArray.pushString(String.format("#%06X", 0xFFFFFF and color))
                } else {
                    shadeArray.pushString("#000000")
                }
            }
            palette.putArray(group, shadeArray)
        }

        return palette
    }
}
