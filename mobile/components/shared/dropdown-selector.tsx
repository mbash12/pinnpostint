import { MaterialIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, TextInput, Platform } from 'react-native';
import { useState, useRef, useEffect, useCallback } from 'react';
import { ThemedText } from '@/components/themed-text';
import { Colors, WebShadows } from '@/constants/theme';

interface DropdownSelectorProps {
  label: string;
  value: string;
  options: string[];
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

export function DropdownSelector({
  label,
  value,
  options,
  isOpen,
  onToggle,
  onSelect,
  error,
  required = false,
  disabled = false,
}: DropdownSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isContainerFocused, setIsContainerFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const optionsListRef = useRef<ScrollView>(null);
  const triggerRef = useRef<TouchableOpacity>(null);

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Include the "-- Select --" option in the count
  const allOptions = ['-- Select --', ...filteredOptions];

  // Focus search input when dropdown opens, or return focus when it closes
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
        // Auto-highlight first item when dropdown opens (skip "-- Select --")
        if (allOptions.length > 1) {
          setHighlightedIndex(1);
        }
      }, 50);
      return () => clearTimeout(timer);
    } else {
      // When closing, return focus to the trigger so Tab navigation continues correctly
      const timer = setTimeout(() => {
        triggerRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, allOptions.length]);

  // Reset highlighted index when options change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchQuery, options]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && optionsListRef.current) {
      optionsListRef.current.scrollTo({
        y: highlightedIndex * 44, // Approximate height per option
        animated: true,
      });
    }
  }, [highlightedIndex, isOpen]);

  const handleKeyDown = useCallback((event: any) => {
    if (disabled) return;

    const key = event.key;

    // Open dropdown on Enter, Space, or ArrowDown when container is focused
    if (!isOpen && (key === 'Enter' || key === ' ' || key === 'ArrowDown')) {
      event.preventDefault();
      onToggle();
      return;
    }

    if (!isOpen) return;

    // When dropdown is open, handle navigation
    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        setHighlightedIndex(prev => {
          // Skip "-- Select --" option when navigating from keyboard
          if (prev < 0) return 1; // Start from first real option
          const nextIndex = prev < allOptions.length - 1 ? prev + 1 : 1;
          return nextIndex;
        });
        break;

      case 'ArrowUp':
        event.preventDefault();
        setHighlightedIndex(prev => {
          // Skip "-- Select --" option when navigating from keyboard
          if (prev < 0 || prev <= 1) return allOptions.length - 1;
          const nextIndex = prev > 1 ? prev - 1 : allOptions.length - 1;
          return nextIndex;
        });
        break;

      case 'Enter':
        event.preventDefault();
        // If nothing is highlighted, select the first filtered result
        let indexToSelect = highlightedIndex;

        if (indexToSelect < 0) {
          // Default to the first filtered result (skip "-- Select --")
          indexToSelect = allOptions.length > 1 ? 1 : 0;
        }

        // Ensure we don't select "-- Select --" unless it's the only option
        if (allOptions[indexToSelect] === '-- Select --' && allOptions.length > 1) {
          indexToSelect = 1;
        }

        const selectedValue = allOptions[indexToSelect];
        if (selectedValue && selectedValue !== '-- Select --') {
          onSelect(selectedValue);
          onToggle();
          setSearchQuery('');
          setHighlightedIndex(-1);
        }
        break;

      case 'Escape':
        event.preventDefault();
        onToggle();
        setSearchQuery('');
        setHighlightedIndex(-1);
        break;

      case 'Tab':
        // Close dropdown on Tab and let normal tab navigation continue
        event.preventDefault();
        onToggle();
        setSearchQuery('');
        setHighlightedIndex(-1);
        break;
    }
  }, [isOpen, onToggle, onSelect, highlightedIndex, allOptions.length, disabled, searchQuery]);

  const handleOptionSelect = useCallback((optionValue: string) => {
    if (optionValue === '-- Select --') {
      onSelect('');
    } else {
      onSelect(optionValue);
    }
    onToggle();
    setSearchQuery('');
    setIsContainerFocused(false);
  }, [onSelect, onToggle]);

  // Determine label style based on focus state (isOpen simulates focus)
  const labelStyle = [
    styles.label,
    (isOpen || value || isContainerFocused) ? styles.labelFloating : styles.labelUnfocused,
    (isOpen || isContainerFocused) && !error && styles.labelActive,
    error && styles.labelError,
  ];

  // Determine input container style based on focus and error states
  const inputContainerStyle = [
    styles.inputContainer,
    error && styles.inputError,
    (isOpen || isContainerFocused) && styles.inputFocused,
  ];

  return (
    <View
      style={styles.container}
      onKeyDown={Platform.OS === 'web' ? handleKeyDown : undefined}
    >
      <TouchableOpacity
        ref={triggerRef}
        style={styles.touchableArea}
        onPress={disabled ? undefined : onToggle}
        activeOpacity={disabled ? 1 : 0.7}
        focusable={!disabled}
        tabIndex={disabled ? -1 : 0}
        onFocus={() => setIsContainerFocused(true)}
        onBlur={() => setIsContainerFocused(false)}
      >
        <Text style={labelStyle}>{label}{required && <Text style={styles.required}> *</Text>}</Text>
        <View style={inputContainerStyle}>
          <ThemedText style={[
            styles.valueText,
            !value && styles.placeholderText
          ]}>
            {value || (isOpen ? 'Type or select...' : '')}
          </ThemedText>
          <MaterialIcons
            name={isOpen ? "arrow-drop-up" : "arrow-drop-down"}
            size={24}
            color={Colors.light.textSecondary}
          />
        </View>
      </TouchableOpacity>

      {error && (
        <ThemedText style={styles.errorText}>{error}</ThemedText>
      )}

      {isOpen && (
        <View style={styles.optionsWrapper}>
          <View style={styles.optionsContainer}>
            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={20} color={Colors.light.textSecondary} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Type to search..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={Colors.light.textSecondary}
                autoFocus
                onKeyDown={Platform.OS === 'web' ? handleKeyDown : undefined}
                onFocus={() => setIsContainerFocused(true)}
                onBlur={() => setIsContainerFocused(false)}
              />
            </View>
            <ScrollView
              ref={optionsListRef}
              style={styles.optionsList}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {allOptions.map((option, index) => {
                const isHighlighted = index === highlightedIndex;
                return (
                  <TouchableOpacity
                    key={option + index}
                    style={[
                      styles.option,
                      isHighlighted && styles.optionHighlighted,
                    ]}
                    onPress={() => handleOptionSelect(option)}
                    activeOpacity={0.7}
                  >
                    <ThemedText style={[
                      styles.optionText,
                      isHighlighted && styles.optionTextHighlighted,
                    ]}>
                      {option}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.keyboardHint}>
              <ThemedText style={styles.hintText}>
                ↑↓ Navigate • Enter Select • Esc Close
              </ThemedText>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  touchableArea: {
    position: 'relative',
  },
  label: {
    position: 'absolute',
    left: 0,
    fontSize: 16,
    color: Colors.light.textSecondary,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 4,
    zIndex: 1,
    pointerEvents: 'none', // Allow clicks to pass through to the touchable area
  },
  labelFloating: {
    top: -6,
    fontSize: 12,
  },
  labelActive: {
    color: Colors.light.primary,
  },
  labelUnfocused: {
    top: 16,
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  labelError: {
    color: '#FF3B30',
  },
  required: {
    color: Colors.light.darkAccent,
  },
  inputContainer: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.textSecondary,
    fontSize: 16,
    color: Colors.light.text,
    paddingVertical: 12,
    paddingHorizontal: 4,
    paddingTop: 20,
    borderWidth: 0,
  } as any,
  inputError: {
    borderBottomColor: '#FF3B30',
  },
  inputFocused: {
    borderBottomColor: Colors.light.primary,
  },
  valueText: {
    fontSize: 16,
    color: Colors.light.text,
    flex: 1,
  },
  placeholderText: {
    color: Colors.light.textSecondary,
  },
  selectorDisabled: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 2,
  },
  optionsWrapper: {
    position: 'relative',
    zIndex: 1000,
  },
  optionsContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    marginTop: 4,
    ...Platform.select({
      web: {
        boxShadow: WebShadows.medium,
      },
      default: {
        elevation: 2,
        shadowColor: 'rgba(0, 0, 0, 0.1)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
    }),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: '#F9F9F9',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
    marginLeft: 8,
    paddingVertical: 4,
    borderWidth: 0,
  } as any,
  optionsList: {
    maxHeight: 200,
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: '#FFFFFF',
  },
  optionHighlighted: {
    backgroundColor: Colors.light.primaryLight,
  },
  optionText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  optionTextHighlighted: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  keyboardHint: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F5F5F5',
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  hintText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});
