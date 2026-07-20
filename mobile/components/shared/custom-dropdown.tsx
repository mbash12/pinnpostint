import { MaterialIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, TextInput, Platform, NativeSyntheticEvent, TextInputKeyPressEventData, ActivityIndicator } from 'react-native';
import { useState, useRef, useEffect, useCallback } from 'react';
import { ThemedText } from '@/components/themed-text';
import { Colors, WebShadows } from '@/constants/theme';

interface CustomDropdownProps {
  label: string;
  value: string;
  options: string[];
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  // API Search props
  onSearch?: (query: string) => Promise<string[]>;
  searchDelay?: number; // debounce delay in ms, default 300
}

export function CustomDropdown({
  label,
  value,
  options,
  isOpen,
  onToggle,
  onSelect,
  error,
  required = false,
  disabled = false,
  onSearch,
  searchDelay = 300,
}: CustomDropdownProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isContainerFocused, setIsContainerFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const searchInputRef = useRef<any>(null);
  const containerRef = useRef<View>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const optionsScrollRef = useRef<ScrollView>(null);

  // Filter options locally or use API results
  const filteredOptions = onSearch
    ? (searchQuery.trim() === '' || isLoading ? options : searchResults) // Show default options when no query or loading, otherwise show search results
    : options.filter(option =>
        String(option).toLowerCase().includes(searchQuery.toLowerCase())
      );

  // Include the "-- Select --" option in the count
  const allOptions = ['-- Select --', ...filteredOptions];

  // Debounced search function
  const debouncedSearch = useCallback((query: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!onSearch) {
      return; // Local filtering, no API call needed
    }

    if (!query.trim()) {
      setSearchResults([]);
      setHighlightedIndex(-1);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await onSearch(query);
        setSearchResults(results);
        // Auto-highlight first result
        if (results.length > 0) {
          setHighlightedIndex(1);
        } else {
          setHighlightedIndex(0);
        }
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    }, searchDelay);
  }, [onSearch, searchDelay]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
        // Auto-highlight first real item (skip "-- Select --")
        if (filteredOptions.length > 0) {
          setHighlightedIndex(1);
        } else {
          setHighlightedIndex(0);
        }
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setHighlightedIndex(-1);
      setSearchQuery('');
      setSearchResults([]);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    }
  }, [isOpen]);

  // Handle search query changes with debounce
  useEffect(() => {
    if (isOpen && searchQuery !== undefined) {
      debouncedSearch(searchQuery);
    }
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, isOpen, debouncedSearch]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && optionsScrollRef.current) {
      const optionHeight = 44; // Approximate height of each option
      const scrollPosition = Math.max(0, (highlightedIndex - 2) * optionHeight);
      optionsScrollRef.current.scrollTo({ y: scrollPosition, animated: true });
    }
  }, [highlightedIndex, isOpen]);

  const handleKeyPress = useCallback((event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (disabled) return;

    const key = event.nativeEvent.key;

    // Open dropdown on Enter, Space, or ArrowDown when closed
    if (!isOpen && (key === 'Enter' || key === ' ' || key === 'ArrowDown')) {
      onToggle();
      return;
    }

    if (!isOpen) return;

    // Handle keyboard navigation when open
    switch (key) {
      case 'ArrowDown':
        if (isLoading) return; // Don't navigate while loading
        setHighlightedIndex(prev => {
          if (prev < 0) return 1; // Start from first real option
          const nextIndex = prev < allOptions.length - 1 ? prev + 1 : 1;
          return nextIndex;
        });
        break;

      case 'ArrowUp':
        if (isLoading) return; // Don't navigate while loading
        setHighlightedIndex(prev => {
          if (prev < 0 || prev <= 1) return allOptions.length - 1;
          return prev > 1 ? prev - 1 : allOptions.length - 1;
        });
        break;

      case 'Enter':
      case ' ':
        if (isLoading) return; // Don't select while loading

        // Select the highlighted item
        let indexToSelect = highlightedIndex;
        if (indexToSelect < 0) {
          indexToSelect = allOptions.length > 1 ? 1 : 0;
        }

        // Skip "-- Select --" unless it's the only option
        if (allOptions[indexToSelect] === '-- Select --' && allOptions.length > 1) {
          indexToSelect = 1;
        }

        const selectedValue = allOptions[indexToSelect];
        if (selectedValue && selectedValue !== '-- Select --') {
          onSelect(selectedValue);
          onToggle();
          // Return focus to trigger after selection
          setTimeout(() => {
            containerRef.current?.focus();
          }, 50);
        }
        break;

      case 'Escape':
        onToggle();
        // Return focus to trigger after closing
        setTimeout(() => {
          containerRef.current?.focus();
        }, 50);
        break;

      case 'Tab':
        // Close dropdown and allow normal tab navigation
        onToggle();
        break;
    }
  }, [isOpen, onToggle, onSelect, highlightedIndex, allOptions.length, disabled, isLoading]);

  const handleOptionSelect = useCallback((optionValue: string) => {
    if (optionValue === '-- Select --') {
      onSelect('');
    } else {
      onSelect(optionValue);
    }
    onToggle();
  }, [onSelect, onToggle]);

  // Handle focus on the dropdown trigger
  const handleTriggerFocus = useCallback(() => {
    setIsContainerFocused(true);
  }, []);

  const labelStyle = [
    styles.label,
    (isOpen || value || isContainerFocused) ? styles.labelFloating : styles.labelUnfocused,
    (isOpen || isContainerFocused) && !error && styles.labelActive,
    error && styles.labelError,
  ];

  const inputContainerStyle = [
    styles.inputContainer,
    (isOpen || isContainerFocused) && styles.inputFocused,
    error && styles.inputError,
  ];

  return (
    <View style={styles.container}>
      <TouchableOpacity
        ref={containerRef as any}
        style={styles.touchableArea}
        onPress={disabled ? undefined : onToggle}
        activeOpacity={disabled ? 1 : 0.7}
        onFocus={handleTriggerFocus}
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
                onKeyPress={Platform.OS === 'web' ? handleKeyPress : undefined}
                onFocus={() => setIsContainerFocused(true)}
                onBlur={() => setIsContainerFocused(false)}
              />
              {isLoading && (
                <ActivityIndicator size="small" color={Colors.light.primary} style={styles.loadingIndicator} />
              )}
            </View>
            <ScrollView
              ref={optionsScrollRef}
              style={styles.optionsList}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {isLoading && searchQuery.trim() !== '' ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={Colors.light.primary} />
                  <ThemedText style={styles.loadingText}>Searching...</ThemedText>
                </View>
              ) : filteredOptions.length === 0 && searchQuery.trim() !== '' ? (
                <View style={styles.noResultsContainer}>
                  <MaterialIcons name="search-off" size={32} color={Colors.light.textSecondary} />
                  <ThemedText style={styles.noResultsText}>No results found</ThemedText>
                </View>
              ) : (
                allOptions.map((option, index) => {
                  const isHighlighted = index === highlightedIndex;
                  return (
                    <TouchableOpacity
                      key={option + index}
                      id={`option-${index}`}
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
                })
              )}
            </ScrollView>
            <View style={styles.keyboardHint}>
              <ThemedText style={styles.hintText}>
                Space/Enter to open • ↑↓ Navigate • Enter Select • Esc Close
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
    pointerEvents: 'none',
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
  },
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
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    flexDirection: 'row',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  noResultsText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 8,
  },
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
