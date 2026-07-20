import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { FileAttributeInput } from './file-attribute-input';

interface AttachmentSectionProps {
  attachment: string[];
  error?: string;
  onAttachmentChange: (value: string[]) => void;
  title?: string;
}

export function AttachmentSection({
  attachment = [],
  error,
  onAttachmentChange,
  title = 'Job/Service Documents'
}: AttachmentSectionProps) {
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      <ThemedText style={styles.sectionSubtitle}>
        Upload relevant documents like resumes, portfolios, or certificates (PDF or Word)
      </ThemedText>
      <FileAttributeInput
        label=""
        value={attachment}
        onValueChange={onAttachmentChange}
        error={error}
        maxFiles={5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    lineHeight: 18,
  },
});
