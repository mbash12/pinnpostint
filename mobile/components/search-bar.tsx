import { MaterialIcons } from '@expo/vector-icons';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { Shadows, Fonts } from '@/constants/theme';
import { useFilter } from '@/hooks/use-filter';

// Direct color definitions to avoid import issues
const Colors = {
  light: {
    text: '#11181C',
    textSecondary: '#687076',
    primary: '#CC1614',
  }
};

export type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  onFilter?: () => void;
  onSubmitEditing?: () => void;
  placeholder?: string;
  showFilter?: boolean;
  containerStyle?: object;
  translucent?: boolean;
  autoFocus?: boolean;
  searchRowStyle?: object;
};

export type SearchBarRef = {
  focus: () => void;
};

export const SearchBar = forwardRef<SearchBarRef, SearchBarProps>(({
  value,
  onChangeText,
  onClear,
  onFilter,
  onSubmitEditing,
  placeholder = 'Search...',
  showFilter = true,
  containerStyle,
  translucent = false,
  autoFocus = false,
  searchRowStyle,
}, ref) => {
  const { showFilter: isFilterVisible, setShowFilter } = useFilter();
  const inputRef = useRef<TextInput>(null);

  // Expose the focus method via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
  }));

  const handleFilterPress = () => {
    if (onFilter) {
      onFilter();
    } else {
      setShowFilter(true);
    }
  };
  return (
    <View style={[styles.container, containerStyle]}>
      <View style={[styles.searchRow, searchRowStyle]}>
        {/* Search Input Card */}
        <View style={[styles.searchCard, translucent && styles.searchCardTranslucent]}>
          <MaterialIcons 
            name="search" 
            size={22} 
            color={translucent ? '#FFFFFF' : Colors.light.textSecondary} 
            style={styles.searchIcon} 
          />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, translucent && styles.searchInputTranslucent]}
            placeholder={placeholder}
            placeholderTextColor={translucent ? 'rgba(255, 255, 255, 0.7)' : Colors.light.textSecondary}
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmitEditing}
            returnKeyType="search"
            selectionColor={Colors.light.primary}
            cursorColor={Colors.light.primary}
            underlineColorAndroid="transparent"
            autoFocus={autoFocus}
          />
          {value.length > 0 && (
            <TouchableOpacity onPress={onClear} style={styles.clearButton}>
              <MaterialIcons 
                name="clear" 
                size={20} 
                color={translucent ? '#FFFFFF' : Colors.light.textSecondary} 
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Button Card */}
        {showFilter && (
          <TouchableOpacity
            style={[styles.filterCard, translucent && styles.filterCardTranslucent]}
            onPress={handleFilterPress}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="filter-list"
              size={20}
              color={translucent ? '#FFFFFF' : Colors.light.primary}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

SearchBar.displayName = 'SearchBar';

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
    ...Shadows.soft,
  },
  filterCard: {
    width: 42,
    height: 42,
    backgroundColor: '#FFFFFF',
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
    ...Shadows.soft,
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.text,
    paddingVertical: 12,
    height: 42,
    borderRadius: 40,
    paddingRight: 20,
    paddingLeft: 56,
    borderWidth: 0,
    borderColor: 'transparent',
    outlineWidth: 0,
    outlineColor: 'transparent',
    outlineStyle: 'none',
    borderStyle: 'solid',
    fontFamily: Fonts?.sans || 'System',
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  // Translucent styles
  searchCardTranslucent: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    boxShadow: '0px 0px 0px transparent',
    elevation: 0,
  },
  searchInputTranslucent: {
    color: '#FFFFFF',
  },
  filterCardTranslucent: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    boxShadow: '0px 0px 0px transparent',
    elevation: 0,
  },
});