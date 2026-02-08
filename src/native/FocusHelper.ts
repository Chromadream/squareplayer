import { NativeModules, findNodeHandle } from 'react-native';

interface FocusHelperInterface {
  requestFocus(reactTag: number): void;
}

const { FocusHelper } = NativeModules;

/**
 * Request native Android focus on a React Native component ref.
 * Uses findNodeHandle to resolve the native view tag, then calls
 * Android's View.requestFocus() via a native module.
 */
export function requestNativeFocus(ref: React.RefObject<any>): void {
  if (!ref.current) return;
  const tag = findNodeHandle(ref.current);
  if (tag != null) {
    (FocusHelper as FocusHelperInterface).requestFocus(tag);
  }
}

export default FocusHelper as FocusHelperInterface;
