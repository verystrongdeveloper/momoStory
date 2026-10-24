import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  /** 좁은 화면에서 채팅을 열었을 때 표시할 제목 */
  title?: string;
  /** 지정되면 로고 대신 뒤로가기 버튼을 보여준다 */
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

const StoryHeader: React.FC<Props> = ({ title, onBack, rightAction }) => {
  return (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
      ) : null}

      {title ? (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <Text style={styles.brand} numberOfLines={1}>
          MomoStory
        </Text>
      )}
      {rightAction}
    </View>
  );
};

export default StoryHeader;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 56,
    backgroundColor: '#FB94A7',
  },
  backBtn: {
    paddingHorizontal: 6,
  },
  backText: {
    fontSize: 32,
    lineHeight: 36,
    color: 'white',
    fontWeight: 'bold',
  },
  title: {
    flex: 1,
    minWidth: 0,
    marginLeft: 8,
    marginRight: 6,
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  brand: {
    flex: 1,
    marginLeft: 10,
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
