import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import EventPlayer from '@/components/event/EventPlayer';
import { consumePendingEvent } from '@/store/eventStore';

const PREVIEW = `selection : (1)"오늘은 무슨 일이야?" (2)"잠깐 쉬러 왔어." [speaker : 호시노(대책위원회), dialogue : 으헤~ 선생 왔구나. 아저씨는 이제 살았어., emotion : hoshino_feelGood.png, bg : BG_AbydosCouncilRoom.jpg, music : Aira.mp3]
호시노(대책위원회) : 으헤~ 선생 왔구나. 아저씨는 이제 살았어. [emotion : hoshino_feelGood.png]
호시노(대책위원회) : 그러니까, 오늘만큼은 느긋하게 쉬어 가자고. [emotion : hoshino_smallsmile.png]
`;

export default function EventScreen() {
  const [event] = useState(() => consumePendingEvent() ?? { script: PREVIEW });
  const script = event.script;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.ALL).catch(() => undefined);
    return () => {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
    };
  }, []);

  const insets = useSafeAreaInsets();

  if (!script) return <Redirect href="/" />;

  return (
    <View
      style={[
        styles.safe,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      <EventPlayer script={script} onComplete={event.onComplete} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
