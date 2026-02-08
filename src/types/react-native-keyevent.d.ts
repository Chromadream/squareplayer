declare module 'react-native-keyevent' {
  interface KeyEventInstance {
    onKeyDownListener(callback: (event: { keyCode: number; action: number; pressedKey: string }) => void): void;
    onKeyUpListener(callback: (event: { keyCode: number; action: number; pressedKey: string }) => void): void;
    removeKeyDownListener(): void;
    removeKeyUpListener(): void;
  }

  const KeyEvent: KeyEventInstance;
  export default KeyEvent;
}
