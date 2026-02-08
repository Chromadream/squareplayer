# SAF URI Encoding for Android ContentResolver

## Problem

`react-native-saf-x` decodes URIs before returning them to JavaScript. This turns properly encoded SAF tree URIs like:

```
content://com.android.externalstorage.documents/tree/7BDF-ABC7%3AMusic%2F2020.12.23%20ONGEKI%20...%2Fcover.jpg
```

into decoded URIs with raw slashes, spaces, and special characters:

```
content://com.android.externalstorage.documents/tree/7BDF-ABC7:Music/2020.12.23 ONGEKI Sound Collection 04 『No Limit RED Force』 [CD-FLAC]/cover.jpg
```

Android's `DocumentsProvider` rejects these because the unencoded slashes in the document ID become path separators, making the URI structurally invalid.

### Error signature

```
java.lang.UnsupportedOperationException: Unsupported Uri content://com.android.externalstorage.documents/tree/...
    at android.provider.DocumentsProvider.query(...)

java.lang.IllegalArgumentException: Invalid URI: content://com.android.externalstorage.documents/tree/...
    at android.provider.DocumentsContract.getDocumentId(...)
    at android.provider.DocumentsProvider.enforceTree(...)
```

## Solution

Use `encodeContentUri()` from `src/utils/uri.ts` to convert decoded SAF tree URIs into the proper `/tree/<encoded-treeId>/document/<encoded-docId>` format **before** passing them to any Android native API (`ContentResolver`, `MediaMetadataRetriever`, ExoPlayer/Media3, etc.).

### Correct format

```
content://authority/tree/<encodeURIComponent(treeId)>/document/<encodeURIComponent(docId)>
```

### Where encoding is needed

| Call site | URI type | File |
|-----------|----------|------|
| Track playback URL | `track.uri` | `src/store/playerStore.ts` |
| Metadata extraction | `track.uri` | `src/services/metadataParser.ts` |
| Cover art caching (SAF) | `folder.coverArtUri` | `src/services/metadataParser.ts` |
| Embedded cover art extraction | `track.uri` | `src/services/metadataParser.ts` |

### Where encoding is NOT needed

- URIs that already start with `file://` (locally cached files)
- URIs that already contain a `/document/` segment (already properly formatted)
- Non-`content://` URIs

## Key rule

**Every SAF `content://` tree URI from `react-native-saf-x` must be passed through `encodeContentUri()` before reaching any Android native API.** The `treeRootUri` (from `getConfig('library_uri')`) is required as the second argument to construct the proper document-within-tree URI.
