import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

interface ProgressIndicatorProps {
  progress: number;
  title?: string;
  style?: any;
}

export function ProgressIndicator({ progress, title = 'Form Completion', style }: ProgressIndicatorProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        <ThemedText style={styles.percentage}>{Math.round(progress)}%</ThemedText>
      </View>
      <View style={styles.progressBar}>
        <Animated.View 
          style={[
            styles.progressFill, 
            { width: `${progress}%` }
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  percentage: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E5E5',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.light.primary,
    borderRadius: 4,
  },
});
