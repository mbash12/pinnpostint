import { View, StyleSheet, Switch } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';
import { CustomDropdown } from '@/components/shared/custom-dropdown';
import { FileAttributeInput } from './file-attribute-input';
import type { Attribute } from '@/services/categories.service';
import { Colors } from '@/constants/theme';

interface AttributesSectionProps {
  attributes: Attribute[];
  values: Record<string, string>;
  errors: { [key: string]: string };
  dropdownStates: Record<string, boolean>;
  onValueChange: (attrId: string, value: string) => void;
  onToggleDropdown: (dropdown: string) => void;
}

export function AttributesSection({
  attributes,
  values,
  errors,
  dropdownStates,
  onValueChange,
  onToggleDropdown,
}: AttributesSectionProps) {
  if (attributes.length === 0) return null;

  const renderAttribute = (attr: Attribute) => {
    const errorKey = `attr_${attr.id}`;

    switch (attr.type) {
      case 'file':
        return (
          <FileAttributeInput
            key={attr.id}
            label={attr.name}
            value={values[attr.id] || ''}
            onValueChange={(value) => onValueChange(attr.id, value)}
            error={errors[errorKey]}
            required={attr.isRequired}
          />
        );
      case 'select':
        return (
          <CustomDropdown
            key={attr.id}
            label={attr.name}
            value={values[attr.id] || ''}
            options={attr.options || []}
            isOpen={dropdownStates[attr.id] || false}
            onToggle={() => onToggleDropdown(`attr_${attr.id}`)}
            onSelect={(value) => onValueChange(attr.id, value)}
            error={errors[errorKey]}
            required={attr.isRequired}
          />
        );

      case 'textarea':
        return (
          <FloatingLabelInput
            key={attr.id}
            label={attr.name}
            value={values[attr.id] || ''}
            onChangeText={(value) => onValueChange(attr.id, value)}
            error={errors[errorKey]}
            maxLength={1000}
            multiline
            numberOfLines={4}
            required={attr.isRequired}
          />
        );

      case 'number':
        return (
          <FloatingLabelInput
            key={attr.id}
            label={attr.name}
            value={values[attr.id] || ''}
            onChangeText={(value) => {
              // Only allow numbers and optional decimal point
              const numericValue = value.replace(/[^0-9.]/g, '');
              // Ensure only one decimal point
              const parts = numericValue.split('.');
              const finalValue = parts.length > 2
                ? parts[0] + '.' + parts.slice(1).join('')
                : numericValue;
              onValueChange(attr.id, finalValue);
            }}
            error={errors[errorKey]}
            keyboardType="numeric"
            inputMode="numeric"
            maxLength={15}
            required={attr.isRequired}
          />
        );

      case 'boolean':
        return (
          <View key={attr.id} style={styles.booleanField}>
            <View style={styles.booleanLabel}>
              <ThemedText style={styles.fieldLabel}>
                {attr.name}{attr.isRequired ? (
                  <ThemedText style={styles.required}>{' *'}</ThemedText>
                ) : null}
              </ThemedText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Switch
                value={values[attr.id] === 'true'}
                onValueChange={(val) => onValueChange(attr.id, val.toString())}
                trackColor={{ false: Colors.light.border, true: Colors.light.primary }}
                thumbColor={Colors.light.background}
              />
              {errors[errorKey] ? (
                <ThemedText style={[styles.errorText, { marginLeft: 8 }]}>{errors[errorKey]}</ThemedText>
              ) : null}
            </View>
          </View>
        );

      case 'date':
        return (
          <FloatingLabelInput
            key={attr.id}
            label={attr.name}
            value={values[attr.id] || ''}
            onChangeText={(value) => onValueChange(attr.id, value)}
            error={errors[errorKey]}
            placeholder="YYYY-MM-DD"
            maxLength={10}
            required={attr.isRequired}
          />
        );

      case 'email':
        return (
          <FloatingLabelInput
            key={attr.id}
            label={attr.name}
            value={values[attr.id] || ''}
            onChangeText={(value) => onValueChange(attr.id, value)}
            error={errors[errorKey]}
            keyboardType="email-address"
            maxLength={254}
            required={attr.isRequired}
          />
        );

      case 'url':
      case 'website':
        return (
          <FloatingLabelInput
            key={attr.id}
            label={attr.name}
            value={values[attr.id] || ''}
            onChangeText={(value) => onValueChange(attr.id, value)}
            error={errors[errorKey]}
            keyboardType="url"
            maxLength={2048}
            required={attr.isRequired}
          />
        );

      case 'tel':
      case 'phone':
        return (
          <FloatingLabelInput
            key={attr.id}
            label={attr.name}
            value={values[attr.id] || ''}
            onChangeText={(value) => {
              // Only allow numeric characters, max 10 digits
              const numericValue = value.replace(/[^0-9]/g, '').slice(0, 10);
              onValueChange(attr.id, numericValue);
            }}
            error={errors[errorKey]}
            keyboardType="phone-pad"
            maxLength={10}
            required={attr.isRequired}
          />
        );

      default:
        return (
          <FloatingLabelInput
            key={attr.id}
            label={attr.name}
            value={values[attr.id] || ''}
            onChangeText={(value) => onValueChange(attr.id, value)}
            error={errors[errorKey]}
            maxLength={255}
            required={attr.isRequired}
          />
        );
    }
  };

  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>Additional Details</ThemedText>
      {attributes.map(renderAttribute)}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 20,
  },
  booleanField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    marginBottom: 16,
  },
  booleanLabel: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
  },
  required: {
    color: Colors.light.error,
  },
  errorText: {
    fontSize: 12,
    color: Colors.light.error,
    marginTop: 4,
  },
});
