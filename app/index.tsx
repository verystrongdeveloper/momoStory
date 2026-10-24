import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StoryContainer from '@/components/layout/StoryContainer';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';

export default function Home() {
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          // Android adjustResize already removes keyboard height. Add only
          // any overlap still remaining, rather than shrinking the view twice.
          paddingBottom: keyboardInset > 0 ? (Platform.OS === 'ios' || keyboardInset === 1 ? 0 : keyboardInset) : insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      <StoryContainer />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FB94A7',
  },
});
