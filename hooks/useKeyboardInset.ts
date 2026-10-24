import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform, type KeyboardEvent } from 'react-native';

/** 창이 줄어들지 않아 키보드에 가려지는 높이만 돌려준다. */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !window.visualViewport) return;
      const viewport = window.visualViewport;
      const update = () => {
        const field = document.activeElement;
        const editing = field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement;
        const overlap = window.innerHeight - viewport.height - viewport.offsetTop;
        setInset(editing && viewport.scale === 1 && overlap > 100 ? overlap : 0);
      };
      viewport.addEventListener('resize', update);
      viewport.addEventListener('scroll', update);
      document.addEventListener('focusout', update);
      return () => {
        viewport.removeEventListener('resize', update);
        viewport.removeEventListener('scroll', update);
        document.removeEventListener('focusout', update);
      };
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    let keyboardTop: number | null = null;
    const update = () => {
      if (keyboardTop === null) { setInset(0); return; }
      const windowHeight = Dimensions.get('window').height;
      // Android may resize the window before this event arrives. Keep a
      // non-zero value so callers can still recognize the keyboard as open.
      setInset(Math.max(1, windowHeight - keyboardTop));
    };
    const onShow = (event: KeyboardEvent) => { keyboardTop = event.endCoordinates.screenY; update(); };
    const show = Keyboard.addListener(showEvent, onShow);
    const move = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidChangeFrame', onShow);
    const hide = Keyboard.addListener(hideEvent, () => { keyboardTop = null; setInset(0); });
    const dimensions = Dimensions.addEventListener('change', update);
    return () => {
      show.remove();
      hide.remove();
      move.remove();
      dimensions.remove();
    };
  }, []);

  return inset;
}
