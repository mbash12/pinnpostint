import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/header';
import { DesktopHeader } from '@/components/desktop-header';
import { DesktopSidebar } from '@/components/desktop-sidebar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Shadows } from '@/constants/theme';
import { useSidebar } from '@/contexts/sidebar-context';
import { useAuth } from '@/contexts/auth-context';
import { useResponsive } from '@/hooks/use-responsive';

const allTabs = [
  { name: 'index', title: 'Home', icon: 'home', public: true },
  { name: 'browse', title: 'Browse', icon: 'description', public: true },
  { name: 'my-ads', title: 'My Ads', icon: 'dashboard', public: true }, // Made public
  { name: 'blog', title: 'Blog', icon: 'public', public: true },
  { name: 'profile', title: 'Profile', icon: 'person', public: true }, // Made public
];

export default function TabLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const { isAuthenticated } = useAuth();
  const { sidebarVisible, setSidebarVisible } = useSidebar();
  const insets = useSafeAreaInsets();

  // Filter tabs based on authentication status
  const visibleTabs = React.useMemo(() => {
    return allTabs.filter(tab => tab.public || isAuthenticated);
  }, [isAuthenticated]);

  const getActiveTab = () => {
    if (pathname === '/' || pathname === '/(tabs)/') return 'index';
    return pathname.split('/').pop() || 'index';
  };

  const activeTab = getActiveTab();

  const handleTabPress = (tabName: string) => {
    // Check if tab requires authentication
    if ((tabName === 'my-ads' || tabName === 'profile') && !isAuthenticated) {
      router.push('/(auth)/login' as any);
      return;
    }

    if (tabName === 'index') {
      router.push('/(tabs)/' as any);
    } else {
      router.push(`/(tabs)/${tabName}` as any);
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Desktop Header */}
      {isDesktop ? <DesktopHeader onMenuPress={() => setSidebarVisible(true)} /> : <Header />}

      <View style={[styles.mainContent, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: 'none' },
          }}>
          <Tabs.Screen name="index" />
          <Tabs.Screen name="browse" />
          <Tabs.Screen name="my-ads" />
          <Tabs.Screen name="blog" />
          <Tabs.Screen name="profile" />
        </Tabs>
      </View>

      {/* Custom Tab Bar - Only show on mobile */}
      {!isDesktop && (
        <View style={[styles.customTabBar, { bottom: (Platform.OS === 'ios' ? 20 : 10) + insets.bottom }]}>
          {Platform.OS === 'android' ? (
            <View style={[styles.blurContainer, styles.androidBlurBackground]}>
              <View style={styles.tabBarContent}>
                {visibleTabs.map((tab) => (
                  <TouchableOpacity
                    key={tab.name}
                    style={styles.tabItem}
                    onPress={() => handleTabPress(tab.name)}
                  >
                    <View style={styles.tabContent}>
                      <MaterialIcons
                        name={tab.icon as any}
                        size={24}
                        color={activeTab === tab.name ? Colors.light.primary : Colors.light.textSecondary}
                        style={{
                          opacity: activeTab === tab.name ? 1 : 0.6,
                          fontWeight: activeTab === tab.name ? 'bold' : 'normal'
                        }}
                      />
                      <ThemedText
                        style={[
                          styles.tabLabel,
                          {
                            color: activeTab === tab.name ? Colors.light.primary : Colors.light.textSecondary,
                            fontWeight: activeTab === tab.name ? '600' : '400'
                          }
                        ]}
                      >
                        {tab.title}
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <BlurView
              intensity={90}
              tint="light"
              style={styles.blurContainer}
            >
              <View style={styles.tabBarContent}>
                {visibleTabs.map((tab) => (
                  <TouchableOpacity
                    key={tab.name}
                    style={styles.tabItem}
                    onPress={() => handleTabPress(tab.name)}
                  >
                    <View style={styles.tabContent}>
                      <MaterialIcons
                        name={tab.icon as any}
                        size={24}
                        color={activeTab === tab.name ? Colors.light.primary : Colors.light.textSecondary}
                        style={{
                          opacity: activeTab === tab.name ? 1 : 0.6,
                          fontWeight: activeTab === tab.name ? 'bold' : 'normal'
                        }}
                      />
                      <ThemedText
                        style={[
                          styles.tabLabel,
                          {
                            color: activeTab === tab.name ? Colors.light.primary : Colors.light.textSecondary,
                            fontWeight: activeTab === tab.name ? '600' : '400'
                          }
                        ]}
                      >
                        {tab.title}
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </BlurView>
          )}
        </View>
      )}

      {/* Desktop Sidebar */}
      {isDesktop && (
        <DesktopSidebar
          isVisible={sidebarVisible}
          onClose={() => setSidebarVisible(false)}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mainContent: {
    flex: 1,
  },
  customTabBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 20 : 10,
    left: 10,
    right: 10,
    height: 70,
  },
  blurContainer: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
    ...Shadows.soft,
  },
  androidBlurBackground: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  tabBarContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  tabContent: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  desktopContent: {
    flex: 1,
    paddingTop: 120, // Account for desktop header height
  },
});
