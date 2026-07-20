import { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { NetworkImage } from '@/components/ui/network-image';
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthProtection } from '@/components/auth-protection';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';
import { GradientButton } from '@/components/ui/gradient-button';
import { AvatarPlaceholder } from '@/components/ui/avatar-placeholder';
import { CustomDropdown } from '@/components/shared/custom-dropdown';
import { Footer } from '@/components/footer';
import { Colors, WebShadows } from '@/constants/theme';
import { DesktopProfileLayout } from '@/components/desktop-profile-layout';
import { useAuth } from '@/contexts/auth-context';
import { userService, UpdateUserRequest } from '@/services/user.service';
import { fileUploadService } from '@/services/file-upload.service';
import { useAlert } from '@/components/ui/custom-alert';
import { formatUserName } from '@/utils/user-helpers';
import { validateForm, validateField, profileValidationSchema } from '@/utils/validation';
import type { User } from '@/types/api.types';
import { useResponsive } from '@/hooks/use-responsive';
import { HEADER_HEIGHT } from '@/constants/layout';

export default function UpdateProfileScreen() {
  const { isDesktop } = useResponsive();
  const { user, refreshUser } = useAuth();
  const { showAlert } = useAlert();
  
  // Local state for profile data to avoid auth context update delays
  const [profileData, setProfileData] = useState<User | null>(null);
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCodeId, setPostalCodeId] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [isGenderDropdownOpen, setIsGenderDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [hasUpdatedAvatar, setHasUpdatedAvatar] = useState(false);

  // Validation errors state
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Location dropdown states
  const [stateId, setStateId] = useState('');
  const [cityId, setCityId] = useState('');
  const [isStateDropdownOpen, setIsStateDropdownOpen] = useState(false);
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [isPostalCodeDropdownOpen, setIsPostalCodeDropdownOpen] = useState(false);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [postalCodes, setPostalCodes] = useState<any[]>([]);

  const genderOptions = ['Male', 'Female'];

  // Track avatar state changes
  useEffect(() => {
    // Effect to track avatar changes
  }, [avatar, profileData, user?.avatar, hasUpdatedAvatar]);

  // Fetch states on component mount
  useEffect(() => {
    const fetchStates = async () => {
      try {
        const response = await userService.getStates();
        if (response.success && response.data) {
          setStates(response.data);

          // If stateId is already set but we just loaded the states, update the display name
          if (stateId) {
            const foundState = response.data.find((s: any) => s.id === stateId);
            if (foundState) {
              setState(foundState.name);
            }
          }
        }
      } catch (error) {
      }
    };

    fetchStates();
  }, []); // Remove stateId dependency to avoid infinite re-renders
  
  // Fetch cities when state changes
  useEffect(() => {
    if (stateId) {
      const fetchCities = async () => {
        try {
          const response = await userService.getCities({ stateId });
          if (response.success && response.data) {
            setCities(response.data);

            // If cityId is already set but we just loaded the cities, update the display name
            if (cityId) {
              const foundCity = response.data.find((c: any) => c.id === cityId);
              if (foundCity) {
                setCity(foundCity.name);
              }
            }
          }
        } catch (error) {
        }
      };

      fetchCities();
    } else {
      setCities([]);
      setCityId('');
      setPostalCodes([]);
    }
  }, [stateId, cityId]); // Add cityId as dependency to handle updates
  
  // Fetch postal codes when city changes
  useEffect(() => {
    if (cityId) {
      const fetchPostalCodes = async () => {
        try {
          const response = await userService.getPostalCodes({ cityId });
          if (response.success && response.data) {
            setPostalCodes(response.data);
          }
        } catch (error) {
        }
      };

      fetchPostalCodes();
    } else {
      setPostalCodes([]);
      setPostalCodeId('');
    }
  }, [cityId]); // Only depend on cityId

  // Effect to update display names when location data becomes available
  useEffect(() => {
    if (stateId && states.length > 0) {
      const foundState = states.find((s: any) => s.id === stateId);
      if (foundState && foundState.name !== state) {
        setState(foundState.name);
      }
    }
  }, [states, stateId]);

  useEffect(() => {
    if (cityId && cities.length > 0) {
      const foundCity = cities.find((c: any) => c.id === cityId);
      if (foundCity && foundCity.name !== city) {
        setCity(foundCity.name);
      }
    }
  }, [cities, cityId]);

  // Effect to update postal code display when postal codes data becomes available
  useEffect(() => {
    if (postalCodeId && postalCodes.length > 0) {
      const foundPostalCode = postalCodes.find((p: any) => p.id === postalCodeId);
      if (foundPostalCode) {
        // The dropdown value for postal code is already handled by the dropdown's value prop
        // which uses postalCodes.find(p => p.id === postalCodeId)?.code
      }
    }
  }, [postalCodes, postalCodeId]);

  // Fetch current user profile on component mount
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await userService.getProfile();
        if (response.success && response.data) {
          // Update local profile state and trigger auth context update
          setProfileData(response.data);
          refreshUser();
        }
      } catch (error) {
        showAlert({
          title: 'Error',
          message: 'Failed to load profile data',
          type: 'error',
          buttons: [{ text: 'OK' }]
        });
      }
    };

    fetchUserProfile();
  }, []); // Only run once on mount

  useEffect(() => {
    // Use profileData from API call first, fall back to auth context user
    const currentUser = profileData || user;

    if (currentUser) {
      setFirstName(currentUser.firstName || '');
      setLastName(currentUser.lastName || '');
      setEmail(currentUser.email || '');
      setPhone(currentUser.phone || '');
      // Only update avatar from user data if we haven't just uploaded a new one
      if (!hasUpdatedAvatar) {
        setAvatar(currentUser.avatar || null);
      }
      setBio(currentUser.profile?.bio || '');
      setAddress(currentUser.profile?.address || '');
      // Handle both cases: when city is an object with name property or just a name string
      // Only set cityId here, name will be handled by separate effect
      setCityId(currentUser.profile?.city?.id || currentUser.profile?.cityId || '');
      // Only set the name if location data is not available yet
      if (!cities.length && currentUser.profile?.city) {
        const cityName = typeof currentUser.profile?.city === 'string'
          ? currentUser.profile?.city
          : currentUser.profile?.city?.name || '';
        setCity(cityName);
      }
      // Handle both cases: when state is an object with name property or just a name string
      setStateId(currentUser.profile?.state?.id || currentUser.profile?.stateId || '');
      // Only set the name if location data is not available yet
      if (!states.length && currentUser.profile?.state) {
        const stateName = typeof currentUser.profile?.state === 'string'
          ? currentUser.profile?.state
          : currentUser.profile?.state?.name || '';
        setState(stateName);
      }
      setPostalCodeId(currentUser.profile?.postalCodeId || '');
      const currentGender = currentUser.profile?.gender;
      if (currentGender === 'male' || currentGender === 'female') {
        setGender(currentGender);
      } else {
        setGender(''); // Reset to empty for 'other' or any invalid values
      }
    }
  }, [user, profileData, hasUpdatedAvatar]); // Removed states and cities from dependency array

  const handleSave = async () => {
    if (!user) return;

    // Validate form data - only validate user-editable fields
    const formData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      bio: bio.trim(),
      address: address.trim(),
    };

    // Create a modified schema with only the fields we want to validate
    const modifiedSchema = {
      firstName: profileValidationSchema.firstName,
      lastName: profileValidationSchema.lastName,
      email: {
        ...profileValidationSchema.email,
        required: false, // Make email optional
      },
      phone: profileValidationSchema.phone,
      bio: profileValidationSchema.bio,
      address: profileValidationSchema.address,
    };

    // Validate only the user-editable fields with modified schema
    const validationErrors = validateForm(formData, modifiedSchema);

    // Handle email validation separately since it's optional
    const finalErrors: Record<string, string> = {};

    // Add all validation errors except email and location IDs
    Object.entries(validationErrors).forEach(([key, value]) => {
      if (key !== 'email' && !['cityId', 'stateId', 'postalCodeId'].includes(key)) {
        finalErrors[key] = value;
      }
    });

    // Only validate email if it's provided
    if (email && email.trim() !== '') {
      const emailError = validateField(email.trim(), modifiedSchema.email);
      if (emailError) {
        finalErrors.email = emailError;
      }
    }

    // If there are validation errors, show them and don't proceed
    if (Object.keys(finalErrors).length > 0) {
      setErrors(finalErrors);

      // Show an alert with detailed validation errors
      const errorMessages = Object.entries(finalErrors).map(([field, message]) => {
        // Convert field names to user-friendly labels
        const fieldLabels: Record<string, string> = {
          firstName: 'First Name',
          lastName: 'Last Name',
          email: 'Email',
          phone: 'Phone',
          bio: 'Bio',
          address: 'Address',
        };
        const fieldLabel = fieldLabels[field] || field;
        return `${fieldLabel}: ${message}`;
      });

      showAlert({
        title: 'Validation Error',
        message: errorMessages.join('\n'),
        type: 'error',
        buttons: [{ text: 'OK' }]
      });

      return;
    }

    // Clear previous errors
    setErrors({});

    setIsLoading(true);
    try {
      const updateData: UpdateUserRequest = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email || undefined,
        phone: phone.trim(),
        avatar: avatar || undefined,
        bio: bio.trim(),
        address: address.trim(),
        cityId: cityId.trim() || undefined,
        stateId: stateId.trim() || undefined,
        country: "India",
        postalCodeId: postalCodeId.trim() || undefined,
        gender: gender || undefined,
      };


      const response = await userService.updateProfile(updateData);

      if (response.success && response.data) {
        // Update local profile state immediately
        setProfileData(response.data);
        // Update auth context
        await refreshUser();

        // Reset the flag after successful update to allow future avatar updates
        setHasUpdatedAvatar(false);

        showAlert({
          title: 'Success',
          message: 'Profile updated successfully!',
          type: 'success',
          buttons: [{
            text: 'OK'
          }]
        });
      } else {
        const errorMessage = response.message || response.error?.message || 'Failed to update profile';
        showAlert({
          title: 'Error',
          message: errorMessage,
          type: 'error',
          buttons: [{ text: 'OK' }]
        });
      }
    } catch (error: any) {
      showAlert({
        title: 'Error',
        message: error.message || 'Failed to update profile',
        type: 'error',
        buttons: [{ text: 'OK' }]
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        showAlert({
          title: 'Permission Required',
          message: 'Please grant camera roll permissions to change your profile photo.',
          type: 'error',
          buttons: [{ text: 'OK' }]
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploadingImage(true);
        try {
          const uploadResponse = await fileUploadService.uploadImageFromAsset(result.assets[0]);
          
          if (uploadResponse.success && uploadResponse.data) {
            setAvatar(uploadResponse.data.url);
            setHasUpdatedAvatar(true);
            showAlert({
              title: 'Success',
              message: 'Photo uploaded successfully!',
              type: 'success',
              buttons: [{ text: 'OK' }]
            });
          } else {
            showAlert({
              title: 'Error',
              message: uploadResponse.message || 'Failed to upload photo',
              type: 'error',
              buttons: [{ text: 'OK' }]
            });
          }
        } catch (error: any) {
          showAlert({
            title: 'Error',
            message: error.message || 'Failed to upload photo',
            type: 'error',
            buttons: [{ text: 'OK' }]
          });
        } finally {
          setIsUploadingImage(false);
        }
      }
    } catch (error: any) {
      showAlert({
        title: 'Error',
        message: 'Failed to select image',
        type: 'error',
        buttons: [{ text: 'OK' }]
      });
    }
  };

  return (
    <AuthProtection>
      <DesktopProfileLayout>
        <ThemedView style={[styles.container, { paddingTop: isDesktop ? 0 : HEADER_HEIGHT }]}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* User Card */}
          <ThemedView style={styles.userCard}>
            {isUploadingImage ? (
              <AvatarPlaceholder size={80} style={styles.avatar} />
            ) : avatar ? (
              <NetworkImage
                key={avatar}
                source={{ uri: avatar }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <AvatarPlaceholder size={80} style={styles.avatar} />
            )}
            <ThemedView style={styles.userInfo}>
              <ThemedText style={styles.userName}>
                {formatUserName(user, 'Loading...')}
              </ThemedText>
              <GradientButton
                title="Change Photo"
                onPress={handleChangePhoto}
                variant="secondary"
                size="small"
                icon="camera-alt"
                style={styles.changePhotoButton}
                disabled={isUploadingImage}
              />
            </ThemedView>
          </ThemedView>

          {/* Form */}
          <ThemedView style={styles.form}>
            <ThemedText style={styles.sectionTitle}>Contact Information</ThemedText>
            
            <FloatingLabelInput
              label="First Name"
              value={firstName}
              maxLength={50}
              onChangeText={(text) => {
                setFirstName(text);
                if (errors.firstName) {
                  const newErrors = { ...errors };
                  delete newErrors.firstName;
                  setErrors(newErrors);
                }
              }}
              error={errors.firstName}
              containerStyle={styles.formField}
            />
            <View style={styles.helperRow}>
              <ThemedText style={styles.characterCounter}>
                {firstName.length}/50
              </ThemedText>
            </View>

            <FloatingLabelInput
              label="Last Name"
              value={lastName}
              maxLength={50}
              onChangeText={(text) => {
                setLastName(text);
                if (errors.lastName) {
                  const newErrors = { ...errors };
                  delete newErrors.lastName;
                  setErrors(newErrors);
                }
              }}
              error={errors.lastName}
              containerStyle={styles.formField}
            />
            <View style={styles.helperRow}>
              <ThemedText style={styles.characterCounter}>
                {lastName.length}/50
              </ThemedText>
            </View>

            <FloatingLabelInput
              label="Email"
              value={email}
              maxLength={254}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) {
                  const newErrors = { ...errors };
                  delete newErrors.email;
                  setErrors(newErrors);
                }
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
              containerStyle={styles.formField}
            />

            <FloatingLabelInput
              label="Phone"
              value={phone}
              maxLength={10}
              onChangeText={(text) => {
                // Only allow numeric characters (no + sign)
                const numericValue = text.replace(/[^0-9]/g, '');
                setPhone(numericValue);
                if (errors.phone) {
                  const newErrors = { ...errors };
                  delete newErrors.phone;
                  setErrors(newErrors);
                }
              }}
              keyboardType="phone-pad"
              error={errors.phone}
              containerStyle={styles.formField}
            />
            <View style={styles.helperRow}>
              <ThemedText style={styles.characterCounter}>
                {phone.length}/10
              </ThemedText>
            </View>

            <ThemedText style={styles.sectionTitle}>Profile Information</ThemedText>

            <FloatingLabelInput
              label="Bio"
              value={bio}
              maxLength={500}
              onChangeText={(text) => {
                setBio(text);
                if (errors.bio) {
                  const newErrors = { ...errors };
                  delete newErrors.bio;
                  setErrors(newErrors);
                }
              }}
              multiline
              numberOfLines={3}
              error={errors.bio}
              containerStyle={[styles.textAreaContainer, styles.formField]}
            />
            <View style={styles.helperRow}>
              <ThemedText style={styles.characterCounter}>
                {bio.length}/500
              </ThemedText>
            </View>

            <FloatingLabelInput
              label="Address"
              value={address}
              maxLength={200}
              onChangeText={(text) => {
                setAddress(text);
                if (errors.address) {
                  const newErrors = { ...errors };
                  delete newErrors.address;
                  setErrors(newErrors);
                }
              }}
              error={errors.address}
              containerStyle={styles.formField}
            />
            <View style={styles.helperRow}>
              <ThemedText style={styles.characterCounter}>
                {address.length}/200
              </ThemedText>
            </View>

            <CustomDropdown
              label="State"
              value={stateId ? states.find(s => s.id === stateId)?.name || state : ''}
              options={states.map(s => s.name)} // Show initial states
              isOpen={isStateDropdownOpen}
              onToggle={() => setIsStateDropdownOpen(!isStateDropdownOpen)}
              onSelect={(value) => {
                const selectedState = states.find(s => s.name === value);
                if (selectedState) {
                  setStateId(selectedState.id);
                  setState(selectedState.name);
                }
                setIsStateDropdownOpen(false);
              }}
              onSearch={async (query) => {
                try {
                  const response = await userService.getStates({ search: query });
                  if (response.success && response.data) {
                    return response.data.map((s: any) => s.name);
                  }
                  return [];
                } catch (error) {
                  console.error('Error searching states:', error);
                  return [];
                }
              }}
              searchDelay={400}
            />

            <CustomDropdown
              label="City"
              value={cityId ? cities.find(c => c.id === cityId)?.name || city : ''}
              options={cities.map(c => c.name)} // Show initial cities
              isOpen={isCityDropdownOpen}
              onToggle={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
              onSelect={(value) => {
                const selectedCity = cities.find(c => c.name === value);
                if (selectedCity) {
                  setCityId(selectedCity.id);
                  setCity(selectedCity.name);
                }
                setIsCityDropdownOpen(false);
              }}
              disabled={!stateId}
              onSearch={async (query) => {
                if (!stateId) return [];
                try {
                  const response = await userService.getCities({ stateId, search: query });
                  if (response.success && response.data) {
                    return response.data.map((c: any) => c.name);
                  }
                  return [];
                } catch (error) {
                  console.error('Error searching cities:', error);
                  return [];
                }
              }}
              searchDelay={400}
            />


            <CustomDropdown
              label="Postal Code"
              value={postalCodeId ? postalCodes.find(p => p.id === postalCodeId)?.code || '' : ''}
              options={postalCodes.map(p => p.code)} // Show initial postal codes
              isOpen={isPostalCodeDropdownOpen}
              onToggle={() => setIsPostalCodeDropdownOpen(!isPostalCodeDropdownOpen)}
              onSelect={(value) => {
                const selectedPostalCode = postalCodes.find(p => p.code === value);
                if (selectedPostalCode) {
                  setPostalCodeId(selectedPostalCode.id);
                }
                setIsPostalCodeDropdownOpen(false);
              }}
              disabled={!cityId}
              onSearch={async (query) => {
                if (!cityId) return [];
                try {
                  const response = await userService.getPostalCodes({ cityId, search: query });
                  if (response.success && response.data) {
                    return response.data.map((p: any) => p.code);
                  }
                  return [];
                } catch (error) {
                  console.error('Error searching postal codes:', error);
                  return [];
                }
              }}
              searchDelay={400}
            />
                        <FloatingLabelInput
              label="Country"
              value="India"
              editable={false}
              onChangeText={() => {}}
              containerStyle={styles.formField}
            />

            <CustomDropdown
              label="Gender"
              value={gender}
              options={genderOptions}
              isOpen={isGenderDropdownOpen}
              onToggle={() => setIsGenderDropdownOpen(!isGenderDropdownOpen)}
              onSelect={(value) => setGender(value.toLowerCase() as 'male' | 'female' | '')}
            />

            <GradientButton
              title="Save Changes"
              onPress={handleSave}
              style={styles.saveButton}
              disabled={isLoading}
              loading={isLoading}
            />
          </ThemedView>
          {!isDesktop && <Footer />}
        </ScrollView>
        </ThemedView>
      </DesktopProfileLayout>
    </AuthProtection>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 16,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    boxShadow: WebShadows.soft,
    elevation: 1,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 10,
  },
  changePhotoButton: {
    alignSelf: 'flex-start',
  },
  form: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 16,
    marginTop: 16,
  },
  textAreaContainer: {
    marginBottom: 24,
  },
  formField: {
    marginBottom: 20,
  },
  saveButton: {
    marginTop: 30,
  },
  helperRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: -8,
    marginBottom: 8,
  },
  characterCounter: {
    fontSize: 11,
    color: '#666666',
    marginLeft: 8,
  },
});
