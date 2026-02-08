import { NativeModules, Platform } from 'react-native';

const { NotificationPermission } = NativeModules;

interface NotificationPermissionModule {
  /** Check if notification permission is granted */
  checkPermission(): Promise<boolean>;
  /** Request notification permission from the user (Android 13+) */
  requestPermission(): Promise<boolean>;
}

export default NotificationPermission as NotificationPermissionModule;
