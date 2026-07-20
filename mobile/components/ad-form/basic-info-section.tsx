import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { CustomDropdown } from '@/components/shared/custom-dropdown';
import { Colors } from '@/constants/theme';

export type AdType = 'SELL' | 'BUY' | 'RENT' | 'GIVEAWAY' | 'HIRING' | 'SEEKING' | 'OFFERING';

interface BasicInfoSectionProps {
  formData: {
    adType: AdType;
  };
  errors: { [key: string]: string };
  showAdTypeOptions: boolean;
  onInputChange: (field: string, value: string) => void;
  onToggleDropdown: (dropdown: string) => void;
  adTypeOptions?: AdType[]; // Make ad types dynamic based on category
}

const AD_TYPE_LABELS: Record<AdType, string> = {
  SELL: 'Sell',
  BUY: 'Buy',
  RENT: 'Rent',
  GIVEAWAY: 'Give Away',
  HIRING: 'Hiring',
  SEEKING: 'Seeking',
  OFFERING: 'Offering',
};

export function BasicInfoSection({
  formData,
  errors,
  showAdTypeOptions,
  onInputChange,
  onToggleDropdown,
  adTypeOptions = ['SELL', 'BUY', 'RENT'], // Default to original types
}: BasicInfoSectionProps) {
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>Provide Item Details</ThemedText>

      <CustomDropdown
        label="Ad Type"
        value={AD_TYPE_LABELS[formData.adType as AdType] || formData.adType}
        options={adTypeOptions.map((type) => AD_TYPE_LABELS[type] || type)}
        isOpen={showAdTypeOptions}
        onToggle={() => onToggleDropdown('showAdTypeOptions')}
        onSelect={(label) => {
          // Find the ad type value from the label
          const selectedType = Object.entries(AD_TYPE_LABELS).find(
            ([_, value]) => value === label
          )?.[0] as AdType || label;
          onInputChange('adType', selectedType);
        }}
        required={true}
      />
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
});
