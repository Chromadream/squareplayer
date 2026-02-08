import { NativeModules } from 'react-native';

interface MetadataProgressInterface {
  /** Show the progress notification with the given total track count */
  show(total: number): Promise<void>;
  /** Update the notification progress */
  update(current: number, total: number, trackName: string | null): Promise<void>;
  /** Dismiss the notification */
  dismiss(): Promise<void>;
}

const { MetadataProgress } = NativeModules;

export default MetadataProgress as MetadataProgressInterface;
