import { MaterialIcons } from '@expo/vector-icons';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';

interface ProgressIndicatorProps {
  progress: number;
}

export function ProgressIndicator({ progress }: ProgressIndicatorProps) {
  return (
    <View style={styles.progressSection}>
      <View style={styles.progressHeader}>
        <ThemedText style={styles.progressTitle}>Form Completion</ThemedText>
        <ThemedText style={styles.progressPercentage}>{Math.round(progress)}%</ThemedText>
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
  progressSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FAFAFA',
    marginHorizontal: 20,
    borderRadius: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
});