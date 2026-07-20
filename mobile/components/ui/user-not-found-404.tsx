import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GradientButton } from '@/components/ui/gradient-button';
import { NotFound404 } from '@/components/ui/not-found-404';
import { Colors } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';

interface UserNotFound404Props {
  onBrowseUsers?: () => void;
}

export function UserNotFound404({ onBrowseUsers }: UserNotFound404Props) {
  const router = useRouter();
  const { isDesktop } = useResponsive();

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const handleBrowseUsers = () => {
    router.push('/');
  };

  const customActions = (
    <View style={isDesktop ? desktopStyles.actionsContainer : styles.actionsContainer}>
      <TouchableOpacity
        style={isDesktop ? desktopStyles.backButton : styles.backButton}
        onPress={handleGoBack}
        activeOpacity={0.8}
      >
        <MaterialIcons
          name="arrow-back"
          size={isDesktop ? 24 : 20}
          color={Colors.light.primary}
        />
        <ThemedText style={isDesktop ? desktopStyles.backButtonText : styles.backButtonText}>
          Go Back
        </ThemedText>
      </TouchableOpacity>

      <GradientButton
        title="Go Home"
        onPress={handleBrowseUsers}
        style={isDesktop ? desktopStyles.actionButton : styles.actionButton}
      />
    </View>
  );

  return (
    <NotFound404
      title="User Not Found"
      message="This user profile is no longer available, has been removed, or the link is broken."
      showBackButton={false}
      showHomeButton={false}
      customActions={customActions}
    />
  );
}

const styles = StyleSheet.create({
  actionsContainer: {
    alignItems: 'center',
    gap: 16,
    width: '100%',
    maxWidth: 300,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    borderRadius: 25,
    gap: 8,
    width: '100%',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  actionButton: {
    width: '100%',
  },
});

const desktopStyles = StyleSheet.create({
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    width: '100%',
    maxWidth: 400,
    justifyContent: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    borderRadius: 28,
    gap: 10,
    minWidth: 160,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  actionButton: {
    minWidth: 160,
  },
});