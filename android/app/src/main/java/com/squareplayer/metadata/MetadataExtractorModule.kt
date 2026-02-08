package com.squareplayer.metadata

import android.media.MediaMetadataRetriever
import android.net.Uri
import android.util.Log
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

                    val sampleRateVal = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_SAMPLERATE)
                    putInt("sampleRate", sampleRateVal?.toIntOrNull() ?: 0)

                    val bitsPerSampleVal = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITS_PER_SAMPLE)
                    putInt("bitDepth", bitsPerSampleVal?.toIntOrNull() ?: 0)

                    val trackNumber = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_CD_TRACK_NUMBER)
                    // Track number can be "3" or "3/12" format
                    val trackNum = trackNumber?.split("/")?.firstOrNull()?.trim()?.toIntOrNull() ?: 0
                    putInt("trackNumber", trackNum)

                    val discNumber = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DISC_NUMBER)
                    // Disc number can be "1" or "1/2" format
                    val discNum = discNumber?.split("/")?.firstOrNull()?.trim()?.toIntOrNull() ?: 0
                    putInt("discNumber", discNum)
                }

                promise.resolve(result)
            } catch (e: Exception) {
                Log.e("MetadataExtractor", "Failed to extract metadata for URI: $uriString", e)
                promise.reject("METADATA_ERROR", "Failed to extract metadata: ${e.message}", e)
            } finally {
                try {
                    retriever.release()
                } catch (e: Exception) {
                    Log.w("MetadataExtractor", "Failed to release retriever", e)
                }
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
                Log.e("MetadataExtractor", "Failed to extract cover art from URI: $uriString", e)
                promise.reject("COVER_ART_ERROR", "Failed to extract cover art: ${e.message}", e)
            } finally {
                try {
                    retriever.release()
                } catch (e: Exception) {
                    Log.w("MetadataExtractor", "Failed to release retriever after cover art extraction", e)
                }
            }
        }.start()
    }

    /**
     * Copy a SAF content:// URI (e.g. cover.jpg) to local cache and return a file:// URI.
     * This is needed because React Native's Image component cannot load SAF content URIs.
     */
    @ReactMethod
    fun cacheSafFile(uriString: String, promise: Promise) {
        Thread {
            try {
                val uri = Uri.parse(uriString)
                val hash = MessageDigest.getInstance("MD5")
                    .digest(uriString.toByteArray())
                    .joinToString("") { "%02x".format(it) }

                val cacheDir = File(reactContext.cacheDir, "cover_art")
                if (!cacheDir.exists()) cacheDir.mkdirs()

                val coverFile = File(cacheDir, "$hash.jpg")
                if (!coverFile.exists()) {
                    val resolver = reactContext.contentResolver
                    resolver.openInputStream(uri)?.use { input ->
                        FileOutputStream(coverFile).use { output ->
                            input.copyTo(output)
                        }
                    } ?: throw Exception("Could not open input stream for URI")
                }

                promise.resolve("file://${coverFile.absolutePath}")
            } catch (e: Exception) {
                Log.e("MetadataExtractor", "Failed to cache SAF file from URI: $uriString", e)
                promise.reject("CACHE_FILE_ERROR", "Failed to cache SAF file: ${e.message}", e)
            }
        }.start()
    }
}
