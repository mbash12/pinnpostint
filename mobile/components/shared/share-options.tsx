import { MaterialIcons } from '@expo/vector-icons';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, Dimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

interface ShareOption {
  id: string;
  icon: string;
  label: string;
  color: string;
}

interface ShareOptionsProps {
  visible: boolean;
  onClose: () => void;
  onOptionPress: (option: string) => void;
}

const shareOptions: ShareOption[] = [
  {
    id: 'native',
    icon: 'share',
    label: 'Share...',
    color: Colors.light.primary,
  },
  {
    id: 'whatsapp',
    icon: 'chat',
    label: 'WhatsApp',
    color: '#25D366',
  },
  {
    id: 'email',
    icon: 'mail',
    label: 'Email',
    color: Colors.light.primary,
  },
  {
    id: 'copy',
    icon: 'content-copy',
    label: 'Copy Link',
    color: Colors.light.textSecondary,
  },
];

export function ShareOptions({ visible, onClose, onOptionPress }: ShareOptionsProps) {
  const isDesktop = Platform.OS === 'web' && Dimensions.get('window').width > 1024;

  const renderOption = (option: ShareOption) => (
    <Pressable
      key={option.id}
      style={({ pressed }) => [
        styles.option,
        pressed && styles.optionPressed,
      ]}
      onPress={() => onOptionPress(option.id)}
    >
      <MaterialIcons name={option.icon as any} size={24} color={option.color} />
      <Text style={styles.optionLabel}>{option.label}</Text>
      {option.id === 'native' && (
        <MaterialIcons name="arrow-forward-ios" size={16} color={Colors.light.textTertiary} />
      )}
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.modal, isDesktop && styles.desktopModal]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <ThemedText style={styles.headerTitle}>Share</ThemedText>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <MaterialIcons name="close" size={24} color={Colors.light.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.optionsList}>
            {shareOptions.map(renderOption)}
          </ScrollView>

          {!isDesktop && (
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <ThemedText style={styles.cancelText}>Cancel</ThemedText>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    width: '85%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  desktopModal: {
    width: 'auto',
    minWidth: 320,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  closeButton: {
    padding: 4,
  },
  optionsList: {
    padding: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
    borderRadius: 8,
  },
  optionPressed: {
    backgroundColor: Colors.light.secondary,
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
  },
  cancelButton: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.primary,
  },
});
