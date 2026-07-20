import { useState, useRef, ReactNode } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View, TouchableOpacity } from 'react-native';

import { Colors } from '@/constants/theme';

interface FloatingLabelInputProps extends TextInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  containerStyle?: any;
  rightIcon?: ReactNode;
  leftIcon?: ReactNode;
  required?: boolean;
}

export function FloatingLabelInput({
  label,
  value,
  onChangeText,
  error,
  containerStyle,
  rightIcon,
  leftIcon,
  required,
  ...props
}: FloatingLabelInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  const handleContainerPress = () => {
    inputRef.current?.focus();
  };

  const labelStyle = [
    styles.label,
    isFocused || value ? styles.labelFocused : leftIcon ? styles.labelUnfocusedWithLeftIcon : styles.labelUnfocused,
    error && styles.labelError,
  ];

  const inputStyle: any = [
    styles.input,
    error && styles.inputError,
    isFocused && styles.inputFocused,
    rightIcon && styles.inputWithRightIcon,
    leftIcon && styles.inputWithLeftIcon,
  ];

  return (
    <View style={[styles.container, containerStyle]}>
      <TouchableOpacity
        style={styles.touchableArea}
        onPress={handleContainerPress}
        activeOpacity={1}
        focusable={false}
        tabIndex={-1}
      >
        <Text style={labelStyle}>
          <Text>{label}</Text>
          {required ? (
            <Text style={styles.required}>{' *'}</Text>
          ) : null}
        </Text>
        <View style={styles.inputContainer}>
          {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
          <TextInput
            ref={inputRef}
            style={inputStyle}
            value={value}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="" // Hide placeholder since we have the floating label
            placeholderTextColor={Colors.light.textSecondary}
            selectionColor={Colors.light.primary}
            cursorColor={Colors.light.primary}
            importantForAutofill="no"
            autoComplete="off"
            tabIndex={0}
            {...props}
          />
          {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
        </View>
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}
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
  labelFocused: {
    top: -6,
    fontSize: 12,
    color: Colors.light.primary,
  },
  labelUnfocused: {
    top: 16,
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  labelUnfocusedWithLeftIcon: {
    top: 16,
    fontSize: 16,
    color: Colors.light.textSecondary,
    left: 40,
  },
  labelError: {
    color: '#FF3B30',
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.textSecondary,
    fontSize: 16,
    color: Colors.light.text,
    paddingVertical: 12,
    paddingHorizontal: 4,
    paddingTop: 20,
    borderWidth: 0,
    outlineWidth: 0,
    outlineColor: 'transparent',
    outlineStyle: 'none',
  },
  inputWithRightIcon: {
    paddingRight: 40,
  },
  inputWithLeftIcon: {
    paddingLeft: 40,
  },
  inputError: {
    borderBottomColor: '#FF3B30',
  },
  inputFocused: {
    borderBottomColor: Colors.light.primary,
  },
  leftIcon: {
    position: 'absolute',
    left: 8,
    top: '50%',
    transform: [{ translateY: -12 }],
    zIndex: 1,
  },
  rightIcon: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: [{ translateY: -12 }],
    zIndex: 1,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 2,
  },
  required: {
    color: '#FF3B30',
  },
});