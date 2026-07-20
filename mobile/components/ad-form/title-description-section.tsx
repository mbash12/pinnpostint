import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';

interface TitleDescriptionSectionProps {
  formData: {
    title: string;
    description: string;
  };
  errors: { [key: string]: string };
  onInputChange: (field: string, value: string) => void;
}

export function TitleDescriptionSection({
  formData,
  errors,
  onInputChange,
}: TitleDescriptionSectionProps) {
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>Please provide title and description</ThemedText>

      <FloatingLabelInput
        label="Ad Title *"
        value={formData.title}
        onChangeText={(value) => onInputChange('title', value)}
        error={errors.title}
        maxLength={70}
      />
      <View style={styles.helperRow}>
        <ThemedText style={styles.characterCounter}>
          {formData.title.length}/70
        </ThemedText>
      </View>

      <FloatingLabelInput
        label="Description *"
        value={formData.description}
        onChangeText={(value) => onInputChange('description', value)}
        error={errors.description}
        maxLength={4096}
        multiline
        numberOfLines={4}
      />
      <View style={styles.helperRow}>
        <ThemedText style={styles.characterCounter}>
          {formData.description.length}/4096
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },
  helperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 16,
  },
  helperText: {
    fontSize: 11,
    color: '#666666',
    flex: 1,
    fontStyle: 'italic',
  },
  characterCounter: {
    fontSize: 11,
    color: '#666666',
    marginLeft: 8,
  },
});
