import { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, Dimensions, TouchableOpacity, Linking, Platform, View, ActivityIndicator } from 'react-native';
import { NetworkImage } from '@/components/ui/network-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import RenderHtml from 'react-native-render-html';

import { DesktopSidebar } from '@/components/desktop-sidebar';
import { Footer } from '@/components/footer';
import { MobilePlatformBanners } from '@/components/mobile-platform-banners';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

import { ShareOptions } from '@/components/shared/share-options';
import { BlogNotFound404 } from '@/components/ui/blog-not-found-404';
import { Colors, WebShadows } from '@/constants/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { blogService, Blog as BlogPost } from '@/services/blog.service';
import { platformAdsService, ShareService } from '@/services';
import { SideBanners } from '@/components/home/side-banners';
import { PlatformAd, PlatformAdPosition } from '@/types/api.types';

const { width } = Dimensions.get('window');

export default function BlogDetailScreen() {
  const { slug } = useLocalSearchParams();
  const router = useRouter();
  const { isDesktop, screenWidth } = useResponsive();
  const [blogPost, setBlogPost] = useState<BlogPost | null>(null);
  const [relatedBlogPosts, setRelatedBlogPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [platformAds, setPlatformAds] = useState<PlatformAd[]>([]);
  const [isLoadingPlatformAds, setIsLoadingPlatformAds] = useState(true);
  const [showShareMenu, setShowShareMenu] = useState(false);

  useEffect(() => {
    const fetchPlatformAds = async () => {
      try {
        setIsLoadingPlatformAds(true);
        const response = await platformAdsService.getPlatformAds();
        if (response.success && response.data) {
          setPlatformAds(response.data);
        }
      } catch (error) {
      } finally {
        setIsLoadingPlatformAds(false);
      }
    };
    fetchPlatformAds();
  }, []);

  useEffect(() => {
    const fetchBlogDetail = async () => {
      try {
        setLoading(true);
        setNotFound(false);

        if (!slug || typeof slug !== 'string') {
          setNotFound(true);
          setLoading(false);
          return;
        }

        // Fetch blog detail
        const response = await blogService.getBlogDetail(slug);
        if (response.success && response.data) {
          setBlogPost(response.data);

          // Fetch related blog posts (just latest blog posts for now, excluding current)
          const relatedResponse = await blogService.getBlogs(1, 5);
          if (relatedResponse.success && relatedResponse.data) {
            setRelatedBlogPosts(relatedResponse.data.filter(item => item.id !== response.data!.id));
          }
        } else {
          setNotFound(true);
        }
      } catch (err: any) {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchBlogDetail();
  }, [slug]);

  const handleShare = async () => {
    setShowShareMenu(true);
  };

  const handleShareOption = async (option: string) => {
    if (!blogPost) return;
    setShowShareMenu(false);

    const blogUrl = `${Platform.OS === 'web' ? window.location.origin : ''}/blog/${blogPost.slug}`;
    const shareContent = {
      title: blogPost.title,
      message: `Check out this article: ${blogPost.title}`,
      url: blogUrl,
    };

    try {
      switch (option) {
        case 'native':
          await ShareService.share(shareContent);
          break;
        case 'whatsapp':
          await ShareService.shareViaWhatsApp(shareContent);
          break;
        case 'email':
          await ShareService.shareViaEmail(shareContent);
          break;
        case 'copy':
          if (Platform.OS === 'web') {
            await navigator.clipboard.writeText(blogUrl);
          } else {
            await ShareService.share({ ...shareContent, message: blogUrl });
          }
          break;
      }
    } catch (e: any) {
      if (e.message !== 'Share canceled' && e.message !== 'Share dismissed') {
      }
    }
  };

  const handleRelatedPress = (slug: string) => {
    router.push({ pathname: '/blog/[slug]', params: { slug } });
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </ThemedView>
    );
  }

  if (notFound) {
    if (isDesktop) {
      return (
          <View style={styles.desktopContainer}>
            <DesktopSidebar isVisible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
            <View style={styles.desktopMainContent}>
              <BlogNotFound404 />
            </View>
          </View>
      );
    } else {
      return (
        <ThemedView style={styles.container}>
          <BlogNotFound404 />
          <Footer />
        </ThemedView>
      );
    }
  }

  // Helper to format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Helper to calculate read time
  const calculateReadTime = (content: string) => {
    const wordsPerMinute = 200;
    const words = content.trim().split(/\s+/).length;
    const time = Math.ceil(words / wordsPerMinute);
    return `${time} min read`;
  };

  const authorName = blogPost?.author ? `${blogPost.author.firstName} ${blogPost.author.lastName}` : 'Editorial Team';
  const categoryName = blogPost?.category?.name || 'General';
  const readTime = calculateReadTime(blogPost?.content || '');

  if (isDesktop) {
    return (
      <>
        <ScrollView style={styles.desktopScrollContainer} showsVerticalScrollIndicator={false}>
          <View style={isDesktop ? styles.desktopHomeWrapper : null}>
            {isDesktop && (
              <SideBanners 
                ads={platformAds.filter(ad => ad.position === PlatformAdPosition.LEFT)} 
                position={PlatformAdPosition.LEFT} 
              />
            )}

            <View style={isDesktop ? styles.desktopMainContent : null}>
              <View style={styles.desktopContainer}>
                <DesktopSidebar isVisible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
                <View style={styles.desktopMainContentArea}>
                  {renderDesktopContent()}
                </View>
              </View>
            </View>

            {isDesktop && (
              <SideBanners 
                ads={platformAds.filter(ad => ad.position === PlatformAdPosition.RIGHT)} 
                position={PlatformAdPosition.RIGHT} 
              />
            )}
          </View>
          <Footer />
        </ScrollView>

        <ShareOptions
          visible={showShareMenu}
          onClose={() => setShowShareMenu(false)}
          onOptionPress={handleShareOption}
        />
      </>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

        {/* Immersive Banner */}
        <ThemedView style={styles.bannerContainer}>
          {blogPost?.imageUrl ? (
            <NetworkImage
              source={{ uri: blogPost.imageUrl }}
              style={styles.bannerImage}
              contentFit="cover"
              resizeMode="cover"
            />
          ) : (
            <View style={styles.bannerImage} />
          )}
          <LinearGradient
            colors={['rgba(255, 255, 255, 1)', 'transparent']}
            style={styles.topGradient}
          />
          <LinearGradient
            colors={['transparent', 'rgba(255, 255, 255, 1)']}
            style={styles.bottomGradient}
          />
        </ThemedView>

        {/* Title and Meta */}
        <ThemedView style={styles.titleSection}>
          <View style={styles.categoryBadge}>
            <ThemedText style={styles.categoryText}>{categoryName}</ThemedText>
          </View>
          <ThemedText type="subtitle" style={styles.title}>{blogPost?.title}</ThemedText>

          <ThemedView style={styles.metaRow}>
            <ThemedView style={styles.authorInfo}>
              <MaterialIcons name="person" size={14} color={Colors.light.textSecondary} />
              <ThemedText style={styles.author}>{authorName}</ThemedText>
            </ThemedView>
            <ThemedText style={styles.separator}>•</ThemedText>
            <ThemedText style={styles.date}>{formatDate(blogPost?.publishedAt || '')}</ThemedText>
            <ThemedText style={styles.separator}>•</ThemedText>
            <ThemedText style={styles.readTime}>{readTime}</ThemedText>
          </ThemedView>
        </ThemedView>
        {/* Action Buttons */}
        <ThemedView style={styles.actionSection}>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <FontAwesome name="share-alt" size={18} color={Colors.light.primary} />
            <ThemedText style={styles.actionText}>Share</ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <MobilePlatformBanners ads={platformAds} position="top" style={{ marginVertical: 8, paddingHorizontal: 16 }} />

        {/* Content */}
        <ThemedView style={styles.section}>
          {blogPost?.content ? (
            <RenderHtml
              contentWidth={screenWidth - 40}
              source={{ html: blogPost.content }}
              tagsStyles={tagsStyles}
              baseStyle={htmlBaseStyle}
            />
          ) : (
            <ThemedText>No content available.</ThemedText>
          )}
        </ThemedView>

        {/* Related Blog Posts */}
        {relatedBlogPosts.length > 0 && (
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Related Blog Posts</ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.relatedContainer}
            >
              {relatedBlogPosts.map((item) => (
                <TouchableOpacity key={item.id} style={styles.relatedCard} onPress={() => handleRelatedPress(item.slug)}>
                  {item.imageUrl ? (
                    <NetworkImage
                      source={{ uri: item.imageUrl }}
                      style={styles.relatedImage}
                      contentFit="cover"
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.relatedImage} />
                  )}
                  <ThemedView style={styles.relatedContent}>
                    <ThemedText style={styles.relatedCategory}>{item.category?.name || 'General'}</ThemedText>
                    <ThemedText style={styles.relatedTitle} numberOfLines={2}>{item.title}</ThemedText>
                  </ThemedView>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </ThemedView>
            )}

        <ShareOptions
          visible={showShareMenu}
          onClose={() => setShowShareMenu(false)}
          onOptionPress={handleShareOption}
        />
        <MobilePlatformBanners ads={platformAds} position="bottom" style={{ marginVertical: 8, paddingHorizontal: 16 }} />
        <Footer />
      </ScrollView>
    </ThemedView>
    );

  function renderDesktopContent() {
    return (
      <View style={styles.desktopContentWrapper}>
        {/* Banner */}
        <View style={styles.desktopBannerContainer}>
          {blogPost?.imageUrl ? (
            <NetworkImage
              source={{ uri: blogPost.imageUrl }}
              style={styles.desktopBannerImage}
              contentFit="cover"
              resizeMode="cover"
            />
          ) : (
            <View style={styles.desktopBannerImage} />
          )}
          <View style={styles.desktopCategoryBadge}>
            <ThemedText style={styles.categoryText}>{categoryName}</ThemedText>
          </View>
        </View>

        {/* Main Content Area */}
        <View style={styles.desktopMainArea}>
          {/* Left Column - Main Content */}
          <View style={styles.desktopLeftColumn}>
            {/* Title and Meta */}
            <View style={styles.desktopTitleSection}>
              <ThemedText type="subtitle" style={styles.desktopTitle}>{blogPost?.title}</ThemedText>
              <View style={styles.desktopMetaRow}>
                <View style={styles.authorInfo}>
                  <MaterialIcons name="person" size={16} color={Colors.light.textSecondary} />
                  <ThemedText style={styles.desktopAuthor}>{authorName}</ThemedText>
                </View>
                <ThemedText style={styles.desktopSeparator}>•</ThemedText>
                <ThemedText style={styles.desktopDate}>{formatDate(blogPost?.publishedAt || '')}</ThemedText>
                <ThemedText style={styles.desktopSeparator}>•</ThemedText>
                <ThemedText style={styles.desktopReadTime}>{readTime}</ThemedText>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.desktopActionSection}>
              <TouchableOpacity style={styles.desktopActionButton} onPress={handleShare}>
                <FontAwesome name="share-alt" size={18} color={Colors.light.primary} />
                <ThemedText style={styles.desktopActionText}>Share</ThemedText>
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.desktopSection}>
              {blogPost?.content ? (
                <RenderHtml
                  contentWidth={Number(screenWidth) * 0.66 - 80}
                  source={{ html: blogPost.content }}
                  tagsStyles={desktopTagsStyles}
                  baseStyle={desktopHtmlBaseStyle}
                />
              ) : (
                <ThemedText>No content available.</ThemedText>
              )}
            </View>

            {/* Tags */}
            <View style={styles.desktopSection}>
              <ThemedText style={styles.desktopSectionTitle}>Tags</ThemedText>
              <View style={styles.desktopTagsContainer}>
                {/* Tags are not in API yet, so we hide or use category */}
                <View style={styles.desktopTag}>
                  <ThemedText style={styles.desktopTagText}>#{categoryName}</ThemedText>
                </View>
              </View>
            </View>
          </View>

          {/* Right Column - Sidebar */}
          <View style={styles.desktopRightColumn}>
            {/* Related Blog Posts */}
            {relatedBlogPosts.length > 0 && (
              <View style={styles.desktopRelatedSection}>
                <ThemedText style={styles.desktopSectionTitle}>Related Blog Posts</ThemedText>
                <View style={styles.desktopRelatedList}>
                  {relatedBlogPosts.map((item) => (
                    <TouchableOpacity key={item.id} style={styles.desktopRelatedCard} onPress={() => handleRelatedPress(item.slug)}>
                      {item.imageUrl ? (
                        <NetworkImage
                          source={{ uri: item.imageUrl }}
                          style={styles.desktopRelatedImage}
                          contentFit="cover"
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.desktopRelatedImage} />
                      )}
                      <View style={styles.desktopRelatedContent}>
                        <ThemedText style={styles.desktopRelatedCategory}>{item.category?.name || 'General'}</ThemedText>
                        <ThemedText style={styles.desktopRelatedTitle} numberOfLines={3}>{item.title}</ThemedText>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            </View>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    paddingTop: 80,
  },
  // Desktop Layout
  desktopScrollContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  desktopContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    minHeight: '100%',
  },
  desktopMainContentArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  desktopHomeWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: '100%',
    alignSelf: 'center',
    position: 'relative',
  },
  desktopMainContent: {
    width: '100%',
    maxWidth: 1000,
    position: 'relative',
  },
  desktopContentWrapper: {
    maxWidth: 1000,
    marginHorizontal: 'auto',
    backgroundColor: '#FFFFFF',
  },
  desktopMainArea: {
    flexDirection: 'row',
    padding: 40,
    gap: 40,
  },
  desktopLeftColumn: {
    flex: 2,
  },
  desktopRightColumn: {
    flex: 1,
    minWidth: 300,
  },
  // Banner
  bannerContainer: {
    width: '100%',
    height: width * 0.8, // 5:4 ratio (height = width * 4/5 = width * 0.8)
    marginTop: 0, // No negative margin to prevent banner from going under header
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  // Desktop Banner
  desktopBannerContainer: {
    width: '100%',
    height: 400,
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 32,
    marginTop: 20,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
  },
  desktopBannerImage: {
    width: '100%',
    height: '100%',
  },
  desktopCategoryBadge: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    boxShadow: WebShadows.soft,
    elevation: 2,
  },
  // Mobile-only gradients
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    zIndex: 1,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  // Title Section
  titleSection: {
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
    lineHeight: 32,
  },
  // Desktop Title Section
  desktopTitleSection: {
    marginBottom: 24,
  },
  desktopTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
    lineHeight: 44,
  },
  desktopMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  desktopAuthor: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginLeft: 6,
    fontWeight: '500',
  },
  desktopSeparator: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginHorizontal: 12,
  },
  desktopDate: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  desktopReadTime: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  author: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginLeft: 4,
    fontWeight: '500',
  },
  separator: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginHorizontal: 8,
  },
  date: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  readTime: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  location: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginLeft: 4,
  },
  // Action Buttons
  actionSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSecondary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.primary,
  },
  // Desktop Action Buttons
  desktopActionSection: {
    flexDirection: 'row',
    marginBottom: 32,
    gap: 16,
  },
  desktopActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSecondary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    flex: 1,
    justifyContent: 'center',
  },
  desktopActionText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.primary,
  },
  // Sections
  section: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.primary,
    marginBottom: 16,
  },
  // Desktop Sections
  desktopSection: {
    marginBottom: 32,
  },
  desktopSectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.light.primary,
    marginBottom: 20,
  },
  // Content
  content: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.light.text,
  },
  desktopContentText: {
    fontSize: 18,
    lineHeight: 28,
    color: Colors.light.text,
  },
  // Tags
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: Colors.light.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: '500',
  },
  // Desktop Tags
  desktopTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  desktopTag: {
    backgroundColor: Colors.light.backgroundSecondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  desktopTagText: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '500',
  },
  // Related Blog Posts
  relatedContainer: {
    paddingRight: 20,
  },
  relatedCard: {
    width: 200,
    marginRight: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  relatedImage: {
    width: '100%',
    height: 'auto',
  },
  relatedContent: {
    padding: 12,
  },
  relatedCategory: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.primary,
    marginBottom: 4,
  },
  relatedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    lineHeight: 18,
  },
  // Desktop Related Blog Posts
  desktopRelatedSection: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 16,
    padding: 24,
  },
  desktopRelatedList: {
    gap: 16,
  },
  desktopRelatedCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  desktopRelatedImage: {
    width: 100,
    height: 'auto',
  },
  desktopRelatedContent: {
    flex: 1,
    padding: 16,
  },
  desktopRelatedCategory: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.primary,
    marginBottom: 4,
  },
  desktopRelatedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    lineHeight: 18,
  },
});

// HTML rendering styles for mobile
const htmlBaseStyle = {
  fontSize: 16,
  lineHeight: 24,
  color: Colors.light.text,
};

const tagsStyles: any = {
  p: {
    marginBottom: 12,
    marginTop: 0,
  },
  h1: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginTop: 24,
    marginBottom: 12,
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginTop: 20,
    marginBottom: 10,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
  },
  ul: {
    marginBottom: 12,
    paddingLeft: 20,
  },
  ol: {
    marginBottom: 12,
    paddingLeft: 20,
  },
  li: {
    marginBottom: 4,
  },
  a: {
    color: Colors.light.primary,
    textDecorationLine: 'underline',
  },
  strong: {
    fontWeight: 'bold',
  },
  b: {
    fontWeight: 'bold',
  },
  em: {
    fontStyle: 'italic',
  },
  i: {
    fontStyle: 'italic',
  },
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.primary,
    paddingLeft: 12,
    fontStyle: 'italic',
    marginBottom: 12,
    opacity: 0.8,
  },
  pre: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  code: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
  },
};

// HTML rendering styles for desktop
const desktopHtmlBaseStyle = {
  fontSize: 18,
  lineHeight: 28,
  color: Colors.light.text,
};

const desktopTagsStyles: any = {
  p: {
    marginBottom: 16,
    marginTop: 0,
  },
  h1: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginTop: 32,
    marginBottom: 16,
  },
  h2: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginTop: 28,
    marginBottom: 14,
  },
  h3: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 24,
    marginBottom: 12,
  },
  ul: {
    marginBottom: 16,
    paddingLeft: 24,
  },
  ol: {
    marginBottom: 16,
    paddingLeft: 24,
  },
  li: {
    marginBottom: 8,
  },
  a: {
    color: Colors.light.primary,
    textDecorationLine: 'underline',
  },
  strong: {
    fontWeight: 'bold',
  },
  b: {
    fontWeight: 'bold',
  },
  em: {
    fontStyle: 'italic',
  },
  i: {
    fontStyle: 'italic',
  },
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.primary,
    paddingLeft: 16,
    fontStyle: 'italic',
    marginBottom: 16,
    opacity: 0.8,
  },
  pre: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  code: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 16,
  },
};