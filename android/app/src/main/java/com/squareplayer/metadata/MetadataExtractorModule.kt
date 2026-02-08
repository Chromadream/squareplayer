package com.squareplayer.metadata

import android.media.MediaMetadataRetriever
import android.net.Uri
import com.facebook.react.bridge.*
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest

class MetadataExtractorModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "MetadataExtractor"

    @ReactMethod
    fun extract(uriString: String, promise: Promise) {
        Thread {
            val retriever = MediaMetadataRetriever()
            try {
                val uri = Uri.parse(uriString)
                retriever.setDataSource(reactContext, uri)

                val result = Arguments.createMap().apply {
                    putString("title", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE))
                    putString("artist", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST))
                    putString("albumArtist", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUMARTIST))
                    putString("album", retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM))

                    val durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                    putDouble("duration", (durationMs?.toLongOrNull() ?: 0L) / 1000.0)

                    val bitrateVal = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE)
                    putInt("bitrate", ((bitrateVal?.toIntOrNull() ?: 0) / 1000)) // kbps

                    val sampleRateVal = retriever.extractMetadata(24) // METADATA_KEY_SAMPLERATE = 24 (API 31+)
                    putInt("sampleRate", sampleRateVal?.toIntOrNull() ?: 0)

                    val bitsPerSampleVal = retriever.extractMetadata(25) // METADATA_KEY_BITS_PER_SAMPLE = 25 (API 31+)
                    putInt("bitDepth", bitsPerSampleVal?.toIntOrNull() ?: 0)

                    val trackNumber = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_CD_TRACK_NUMBER)
                    // Track number can be "3" or "3/12" format
                    val trackNum = trackNumber?.split("/")?.firstOrNull()?.trim()?.toIntOrNull() ?: 0
                    putInt("trackNumber", trackNum)
                }

                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("METADATA_ERROR", "Failed to extract metadata: ${e.message}", e)
            } finally {
                try {
                    retriever.release()
                } catch (_: Exception) {}
            }
        }.start()
    }

    @ReactMethod
    fun extractCoverArt(uriString: String, promise: Promise) {
        Thread {
            val retriever = MediaMetadataRetriever()
            try {
                val uri = Uri.parse(uriString)
                retriever.setDataSource(reactContext, uri)

                val art = retriever.embeddedPicture
                if (art != null) {
                    // Hash the URI for a stable filename
                    val hash = MessageDigest.getInstance("MD5")
                        .digest(uriString.toByteArray())
                        .joinToString("") { "%02x".format(it) }

                    val cacheDir = File(reactContext.cacheDir, "cover_art")
                    if (!cacheDir.exists()) cacheDir.mkdirs()

                    val coverFile = File(cacheDir, "$hash.jpg")
                    if (!coverFile.exists()) {
                        FileOutputStream(coverFile).use { it.write(art) }
                    }

                    promise.resolve("file://${coverFile.absolutePath}")
                } else {
                    promise.resolve(null)
                }
            } catch (e: Exception) {
                promise.reject("COVER_ART_ERROR", "Failed to extract cover art: ${e.message}", e)
            } finally {
                try {
                    retriever.release()
                } catch (_: Exception) {}
            }
        }.start()
    }
}
