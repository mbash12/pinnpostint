import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

export type DropdownOption = {
  label: string;
  value: string;
  id?: string;
};

export type DropdownSelectProps = {
  label: string;
  value: string;
  options: DropdownOption[];
  onSelect: (option: DropdownOption) => void;
  placeholder?: string;
  disabled?: boolean;
  width?: number;
};

export function DropdownSelect({
  label,
  value,
  options,
  onSelect,
  placeholder = 'Select...',
  disabled = false,
  width = 200
}: DropdownSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<DropdownOption | null>(null);
  const dropdownRef = useRef<View>(null);

  useEffect(() => {
    const option = options.find(opt => opt.value === value);
    setSelectedOption(option || null);
  }, [value, options]);

  const handleSelect = (option: DropdownOption) => {
    setSelectedOption(option);
    onSelect(option);
    setIsOpen(false);
  };

  const displayText = selectedOption ? selectedOption.label : placeholder;

  return (
    <View style={[styles.container, { width }]}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <TouchableOpacity
        style={[styles.dropdown, disabled && styles.disabled]}
        onPress={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <ThemedText style={[styles.dropdownText, !selectedOption && styles.placeholderText]}>
          {displayText}
        </ThemedText>
        <MaterialIcons 
          name={isOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
          size={20} 
          color={Colors.light.textSecondary} 
        />
      </TouchableOpacity>

      {isOpen && (
        <Modal
          transparent
          visible={isOpen}
          onRequestClose={() => setIsOpen(false)}
          animationType="fade"
        >
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => setIsOpen(false)}
          >
            <View style={[styles.dropdownModal, { width }]}>
              <ScrollView 
                style={styles.optionsList}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {options.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.option,
                      selectedOption?.value === option.value && styles.selectedOption
                    ]}
                    onPress={() => handleSelect(option)}
                  >
                    <ThemedText style={[
                      styles.optionText,
                      selectedOption?.value === option.value && styles.selectedOptionText
                    ]}>
                      {option.label}
                    </ThemedText>
                    {selectedOption?.value === option.value && (
                      <MaterialIcons 
                        name="check" 
                        size={16} 
                        color={Colors.light.primary} 
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 6,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  disabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  dropdownText: {
    fontSize: 14,
    color: Colors.light.text,
    flex: 1,
  },
  placeholderText: {
    color: Colors.light.textSecondary,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    maxHeight: 300,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  optionsList: {
    maxHeight: 280,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  selectedOption: {
    backgroundColor: '#FEF2F2',
  },
  optionText: {
    fontSize: 14,
    color: Colors.light.text,
    flex: 1,
  },
  selectedOptionText: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
});
