import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { storyFont, useLayout } from '@/hooks/useLayout';

interface Props {
  options: string[];
  onSelect: (option: string) => void;
}

const labelOf = (opt: string) => opt.trim().replace(/^["“”]+|["“”]+$/g, '');

const EventSelection: React.FC<Props> = ({ options, onSelect }) => {
  const { eventWidth, eventHeight, isCompact } = useLayout();
  const [fontLoaded, fontError] = useFonts({
    PretendardSemiBold: require('../../assets/fonts/Pretendard-SemiBold.ttf'),
  });
  const styles = useMemo(
    () => makeStyles(eventWidth, eventHeight, fontLoaded, isCompact),
    [eventWidth, eventHeight, fontLoaded, isCompact]
  );

  // 첫 선택지에서도 기본 폰트가 보였다가 전용 폰트로 바뀌지 않게 한다.
  // 로딩 실패 시에는 기본 폰트로 선택지를 표시해 진행을 막지 않는다.
  if (!fontLoaded && !fontError) return null;

  return (
    <View style={styles.container}>
      {options.map((opt, idx) => (
        <TouchableOpacity
          key={idx}
          style={styles.btn}
          onPress={() => onSelect(opt)}
          activeOpacity={0.82}
        >
          <LinearGradient
            colors={['#b9d8f3', '#eef6fc', '#ffffff', '#eef6fc', '#b9d8f3']}
            locations={[0, 0.18, 0.5, 0.82, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.buttonSurface}
          >
            <Text style={styles.text} numberOfLines={2}>
              {labelOf(opt)}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default EventSelection;

const makeStyles = (W: number, H: number, fontLoaded: boolean, isCompact: boolean) =>
  {
    // 짧은 변을 기준으로 잡아, 세로로 긴 화면에서 박스가 캐릭터를 덮지 않게 한다.
    const short = Math.min(W, H);
    // 모바일은 화면의 78%. 좌우에 11%씩 남아 끝까지 붙지 않는다.
    const cardWidth = isCompact ? Math.round(W * 0.78) : Math.min(W * 0.62, short * 1.7);

    return StyleSheet.create({
    container: {
      width: '100%',
      alignItems: 'center',
      gap: Math.max(4, Math.round(short * 0.012)),
    },
    btn: {
      width: cardWidth,
      height: Math.max(40, Math.round(short * 0.068)),
    },
    buttonSurface: {
      flex: 1,
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: cardWidth * 0.05,
      borderWidth: 2,
      borderColor: '#ffffff',
      backgroundColor: '#e7f3fb',
    },
    text: {
      // SemiBold 파일 자체를 쓴다. fontWeight를 올리면 윈도우가 굵기를 합성해
      // 한글 자간이 들쭉날쭉하고 획이 번진다.
      fontFamily: fontLoaded
        ? 'PretendardSemiBold, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif'
        : '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif',
      fontSize: storyFont(W, H, 0.026, 16),
      fontWeight: '400',
      color: '#263f5d',
      textAlign: 'center',
    },
    });
  };
