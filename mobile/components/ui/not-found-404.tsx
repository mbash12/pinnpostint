import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GradientButton } from '@/components/ui/gradient-button';
import { Colors } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';

const { width } = Dimensions.get('window');

interface NotFound404Props {
  title?: string;
  message?: string;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  customActions?: React.ReactNode;
}

export function NotFound404({
  title = 'Page Not Found',
  message = 'The page you\'re looking for doesn\'t exist or has been removed.',
  showBackButton = true,
  showHomeButton = true,
  customActions
}: NotFound404Props) {
  const router = useRouter();
  const { isDesktop } = useResponsive();

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const handleGoHome = () => {
    router.push('/');
  };

  const content = (
    <ThemedView style={isDesktop ? desktopStyles.container : styles.container}>
      {/* 404 Graphic */}
      <ThemedView style={isDesktop ? desktopStyles.graphicContainer : styles.graphicContainer}>
        <ThemedView style={isDesktop ? desktopStyles.iconContainer : styles.iconContainer}>
          <MaterialIcons 
            name="search-off" 
            size={isDesktop ? 120 : 80} 
            color={Colors.light.primary} 
          />
        </ThemedView>
        <ThemedText style={isDesktop ? desktopStyles.fourOhFour : styles.fourOhFour}>404</ThemedText>
      </ThemedView>

      {/* Error Message */}
      <ThemedView style={isDesktop ? desktopStyles.contentContainer : styles.contentContainer}>
        <ThemedText style={isDesktop ? desktopStyles.title : styles.title}>
          {title}
        </ThemedText>
        <ThemedText style={isDesktop ? desktopStyles.message : styles.message}>
          {message}
        </ThemedText>
      </ThemedView>

      {/* Action Buttons */}
      <ThemedView style={isDesktop ? desktopStyles.actionsContainer : styles.actionsContainer}>
        {customActions ? (
          customActions
        ) : (
          <>
            {showBackButton && (
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
            )}
            
            {showHomeButton && (
              <GradientButton
                title="Go Home"
                onPress={handleGoHome}
                style={isDesktop ? desktopStyles.homeButton : styles.homeButton}
              />
            )}
          </>
        )}
      </ThemedView>
    </ThemedView>
  );

  return content;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: '100%',
  },
  graphicContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  fourOhFour: {
    fontSize: 48,
    fontWeight: 'bold',
    color: Colors.light.text,
    opacity: 0.1,
    position: 'absolute',
    top: 50,
  },
  contentContainer: {
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
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
  homeButton: {
    width: '100%',
  },
});

const desktopStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: '100%',
  },
  graphicContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  fourOhFour: {
    fontSize: 72,
    fontWeight: 'bold',
    color: Colors.light.text,
    opacity: 0.08,
    position: 'absolute',
    top: 80,
  },
  contentContainer: {
    alignItems: 'center',
    marginBottom: 48,
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 18,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 28,
  },
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
  homeButton: {
    minWidth: 160,
  },
});