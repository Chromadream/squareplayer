package com.chromadream.squareplayer.notification

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.*

class MetadataProgressModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val CHANNEL_ID = "metadata_progress"
        private const val NOTIFICATION_ID = 1001
    }

    private var notificationManager: NotificationManager? = null
    private var builder: NotificationCompat.Builder? = null

    override fun getName(): String = "MetadataProgress"

    private fun hasNotificationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ActivityCompat.checkSelfPermission(
                reactContext,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    private fun ensureChannel() {
        if (notificationManager != null) return
        notificationManager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Metadata Loading",
                NotificationManager.IMPORTANCE_LOW   // no sound, shows in shade
            ).apply {
                description = "Shows progress while loading track metadata"
                setShowBadge(false)
            }
            notificationManager!!.createNotificationChannel(channel)
        }
    }

    @ReactMethod
    fun show(total: Int, promise: Promise) {
        if (!hasNotificationPermission()) {
            promise.reject("PERMISSION_DENIED", "Notification permission not granted")
            return
        }
        
        ensureChannel()
        val indeterminate = total <= 0
        builder = NotificationCompat.Builder(reactContext, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_popup_sync)
            .setContentTitle(if (indeterminate) "Scanning library" else "Loading metadata")
            .setContentText(if (indeterminate) "Scanning…" else "0 / $total tracks")
            .setProgress(if (indeterminate) 0 else total, 0, indeterminate)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)

        notificationManager?.notify(NOTIFICATION_ID, builder!!.build())
        promise.resolve(null)
    }

    @ReactMethod
    fun update(current: Int, total: Int, trackName: String?, promise: Promise) {
        if (builder == null) {
            promise.resolve(null)
            return
        }
        val indeterminate = total <= 0
        val text = if (indeterminate) {
            trackName ?: "Scanning…"
        } else {
            if (trackName != null) "$current / $total — $trackName" else "$current / $total tracks"
        }
        builder!!
            .setContentText(text)
            .setProgress(if (indeterminate) 0 else total, current, indeterminate)

        notificationManager?.notify(NOTIFICATION_ID, builder!!.build())
        promise.resolve(null)
    }

    @ReactMethod
    fun dismiss(promise: Promise) {
        notificationManager?.cancel(NOTIFICATION_ID)
        builder = null
        promise.resolve(null)
    }
}
