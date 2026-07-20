import React, { ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  FlatList,
  StyleSheet,
  View,
  ViewStyle,
  ScrollViewProps,
} from 'react-native';

import { Footer } from '@/components/footer';
import { ThemedView } from '@/components/themed-view';
import { DesktopContentWrapper } from '@/components/desktop-content-wrapper';
import { useResponsive } from '@/hooks/use-responsive';
import { HEADER_HEIGHT } from '@/constants/layout';

type PageLayoutProps = {
  children: ReactNode;
  scrollable?: boolean;
  noHeaderOffset?: boolean;
  noFooter?: boolean;
  noDesktopWrapper?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  showsVerticalScrollIndicator?: boolean;
  // FlatList mode
  flatList?: boolean;
  flatListProps?: any;
  // RefreshControl
  refreshing?: boolean;
  onRefresh?: () => void;
} & Omit<ScrollViewProps, 'children' | 'style' | 'contentContainerStyle'>;

export function PageLayout({
  children,
  scrollable = true,
  noHeaderOffset = false,
  noFooter = false,
  noDesktopWrapper = false,
  style,
  contentContainerStyle,
  showsVerticalScrollIndicator = false,
  flatList = false,
  flatListProps,
  refreshing,
  onRefresh,
  ...scrollViewProps
}: PageLayoutProps) {
  const { isDesktop } = useResponsive();

  const headerOffset = !isDesktop && !noHeaderOffset ? HEADER_HEIGHT : 0;

  const wrappedContent = noDesktopWrapper ? (
    <View style={styles.content}>
      {children}
    </View>
  ) : (
    <DesktopContentWrapper>
      <View style={styles.content}>
        {children}
      </View>
    </DesktopContentWrapper>
  );

  const footer = !noFooter ? <Footer /> : null;

  // FlatList mode
  if (flatList && flatListProps) {
    return (
      <ThemedView style={[styles.container, style]}>
        <FlatList
          {...flatListProps}
          contentContainerStyle={[
            { paddingTop: headerOffset },
            Platform.OS === 'web' ? styles.webContentContainer : undefined,
            flatListProps.contentContainerStyle,
          ]}
          ListFooterComponent={
            <>
              {flatListProps.ListFooterComponent}
              {footer}
            </>
          }
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      </ThemedView>
    );
  }

  // Scrollable mode
  if (scrollable) {
    return (
      <ThemedView style={[styles.container, style]}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          contentContainerStyle={[
            { paddingTop: headerOffset },
            Platform.OS === 'web' ? styles.webContentContainer : undefined,
            contentContainerStyle,
          ]}
          {...scrollViewProps}
        >
          <View style={styles.webContentFiller}>
            {wrappedContent}
          </View>
          {footer}
        </ScrollView>
      </ThemedView>
    );
  }

  // Non-scrollable mode
  return (
    <ThemedView style={[styles.container, style, { paddingTop: headerOffset }]}>
      {wrappedContent}
      {footer}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  webContentContainer: {
    ...Platform.select({
      web: {
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
      },
    }),
  },
  webContentFiller: {
    flexGrow: 1,
  },
});
