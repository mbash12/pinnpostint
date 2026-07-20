import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { NetworkImage } from '@/components/ui/network-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AvatarPlaceholder } from '@/components/ui/avatar-placeholder';
import { Colors, WebShadows } from '@/constants/theme';

interface UserProfileCardProps {
  name: string;
  avatar?: string;
  onEditPress: () => void;
  isDesktop?: boolean;
}

export function UserProfileCard({ name, avatar, onEditPress, isDesktop = false }: UserProfileCardProps) {
  if (isDesktop) {
    return (
      <View style={styles.desktopCard}>
        <View style={styles.desktopUserSection}>
          {avatar ? (
            <NetworkImage
              source={{ uri: avatar }}
              style={styles.desktopAvatar}
              placeholder={require('@/assets/images/placeholder.png')}
            />
          ) : (
            <AvatarPlaceholder size={120} style={styles.desktopAvatar} />
          )}
          <View style={styles.desktopUserDetails}>
            <ThemedText style={styles.desktopUserName}>{name}</ThemedText>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={onEditPress}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[Colors.light.gradientStart, Colors.light.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.desktopEditGradient}
              >
                <ThemedText style={styles.editButtonText}>Edit Profile</ThemedText>
                <MaterialIcons name="edit" size={16} color="#FFFFFF" style={styles.editIcon} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ThemedView style={styles.card}>
      {avatar ? (
        <NetworkImage
          source={{ uri: avatar }}
          style={styles.avatar}
          placeholder={require('@/assets/images/placeholder.png')}
        />
      ) : (
        <AvatarPlaceholder size={80} style={styles.avatar} />
      )}
      <ThemedView style={styles.userInfo}>
        <ThemedText style={styles.userName}>{name}</ThemedText>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={onEditPress}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[Colors.light.gradientStart, Colors.light.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.editGradient}
          >
            <ThemedText style={styles.editButtonText}>Edit Profile</ThemedText>
            <MaterialIcons name="edit" size={16} color="#FFFFFF" style={styles.editIcon} />
          </LinearGradient>
        </TouchableOpacity>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  // Mobile styles
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 16,
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
  editButton: {
    borderRadius: 25,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  editGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 4,
    gap: 6,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  editIcon: {
    marginLeft: 2,
  },

  // Desktop styles
  desktopCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    boxShadow: WebShadows.medium,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  desktopUserSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  desktopAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  desktopUserDetails: {
    flex: 1,
  },
  desktopUserName: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 16,
  },
  desktopEditGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
});
