const TREE_PATH = '/tree/';
const DOCUMENT_PATH = '/document/';

/**
 * Convert a decoded SAF tree URI to a proper document-within-tree URI
 * that ContentResolver / ExoPlayer can handle.
 *
 * react-native-saf-x decodes URIs before returning them to JS, which turns:
 *   content://authority/tree/vol%3Apath%2Fsubdir%2Ffile.flac
 * into:
 *   content://authority/tree/vol:path/subdir/file.flac
 *
 * This breaks ContentResolver because the slashes in the document ID become
 * path separators. The proper format Android expects is:
 *   content://authority/tree/<encoded-treeId>/document/<encoded-docId>
 *
 * @param childUri   The decoded SAF tree URI for a file or cover image
 * @param treeRootUri The root tree URI from openDocumentTree (library_uri)
 */
function toSafDocumentUri(childUri: string, treeRootUri: string): string {
  const childTreeIdx = childUri.indexOf(TREE_PATH);
  if (childTreeIdx === -1) return childUri;

  const scheme = childUri.substring(0, childTreeIdx); // "content://authority"
  const childDocId = childUri.substring(childTreeIdx + TREE_PATH.length);

  const rootTreeIdx = treeRootUri.indexOf(TREE_PATH);
  if (rootTreeIdx === -1) return childUri;
  const treeId = treeRootUri.substring(rootTreeIdx + TREE_PATH.length);

  return (
    scheme +
    TREE_PATH +
    encodeURIComponent(treeId) +
    DOCUMENT_PATH +
    encodeURIComponent(childDocId)
  );
}

/**
 * Encode a content URI for use with ContentResolver / ExoPlayer.
 * Converts decoded SAF tree URIs to proper document-within-tree URIs.
 * Non-SAF URIs (file://, etc.) are returned unchanged.
 *
 * @param uri          The URI to encode
 * @param treeRootUri  The library root tree URI (from config 'library_uri')
 */
export function encodeContentUri(
  uri: string,
  treeRootUri?: string | null,
): string {
  if (!uri) return uri;

  // Only process content:// tree URIs
  if (!uri.startsWith('content://') || !uri.includes(TREE_PATH)) return uri;

  // Already has a /document/ segment — properly formatted
  if (uri.includes(DOCUMENT_PATH)) return uri;

  // Convert tree URI → document-within-tree URI
  if (treeRootUri) {
    return toSafDocumentUri(uri, treeRootUri);
  }

  // Fallback without tree root (shouldn't happen in normal flow)
  return uri;
}

/**
 * Encode a content URI if present, otherwise return undefined.
 * Convenience wrapper for optional artwork / track URIs.
 */
export function encodeOptionalUri(
  uri: string | null | undefined,
  treeRootUri?: string | null,
): string | undefined {
  if (!uri) return undefined;
  return encodeContentUri(uri, treeRootUri);
}
