import { StyleSheet, View, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, useWindowDimensions } from 'react-native';
import { useState, useEffect } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { RenderHTML } from 'react-native-render-html';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, WebShadows } from '@/constants/theme';
import { Footer } from '@/components/footer';
import { DesktopProfileLayout } from '@/components/desktop-profile-layout';
import { faqService, FaqItem, FaqCategory } from '@/services/faq.service';
import { settingsService } from '@/services/settings.service';
import { useResponsive } from '@/hooks/use-responsive';
import { HEADER_HEIGHT } from '@/constants/layout';

export default function HelpSupportScreen() {
  const { isDesktop } = useResponsive();
  const { width } = useWindowDimensions();
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [filteredFAQ, setFilteredFAQ] = useState<FaqItem[]>([]);
  const [categories, setCategories] = useState<FaqCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerCareEmail, setCustomerCareEmail] = useState<string>('info@pinnpost.com');

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  useEffect(() => {
    loadFAQs();
    loadCategories();
    loadCustomerCareEmail();
  }, []);

  const loadCustomerCareEmail = async () => {
    try {
      const email = await settingsService.getCustomerCareEmail();
      setCustomerCareEmail(email);
    } catch (error) {
    }
  };

  useEffect(() => {
    let filtered = [...faqItems];

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item =>
        item.category && item.category.id === selectedCategory
      );
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.category && item.category.name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    setFilteredFAQ(filtered);
  }, [searchQuery, selectedCategory, faqItems]);

  const loadFAQs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await faqService.getPublicFaqs(50);

      if (response.success && response.data) {
        setFaqItems(response.data);
        setFilteredFAQ(response.data);
      } else {
        setError('Failed to load FAQs');
      }
    } catch (err) {
      setError('Failed to load FAQs');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const response = await faqService.getFaqCategories();

      if (response.success && response.data) {
        setCategories(response.data);
      }
    } catch (err) {
    } finally {
      setLoadingCategories(false);
    }
  };

  return (
    <DesktopProfileLayout>
      <ThemedView style={[styles.container, { paddingTop: isDesktop ? 0 : HEADER_HEIGHT }]}>
        {!isDesktop ? (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <ThemedText style={styles.title}>Frequently Asked Questions</ThemedText>
              <ThemedText style={styles.subtitle}>
                Find answers to common questions
              </ThemedText>
            </View>

            {/* Customer Care Contact */}
            <View style={styles.contactContainer}>
              <View style={styles.contactContent}>
                <View style={styles.contactIcon}>
                  <MaterialIcons name="email" size={24} color={Colors.light.primary} />
                </View>
                <View style={styles.contactText}>
                  <ThemedText style={styles.contactTitle}>Need More Help?</ThemedText>
                  <ThemedText style={styles.contactEmail}>{customerCareEmail}</ThemedText>
                  <ThemedText style={styles.contactDescription}>
                    Our customer care team is here to assist you
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <View style={styles.searchInput}>
                <MaterialIcons name="search" size={20} color={Colors.light.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="Search questions..."
                  placeholderTextColor={Colors.light.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>

            {/* Category Filter */}
            <View style={styles.categoryFilterContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScrollContainer}
              >
                <TouchableOpacity
                  style={[
                    styles.categoryButton,
                    selectedCategory === 'all' && styles.categoryButtonActive
                  ]}
                  onPress={() => setSelectedCategory('all')}
                >
                  <ThemedText style={[
                    styles.categoryButtonText,
                    selectedCategory === 'all' && styles.categoryButtonTextActive
                  ]}>
                    All
                  </ThemedText>
                </TouchableOpacity>

                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryButton,
                      selectedCategory === category.id && styles.categoryButtonActive
                    ]}
                    onPress={() => setSelectedCategory(category.id)}
                  >
                    <ThemedText style={[
                      styles.categoryButtonText,
                      selectedCategory === category.id && styles.categoryButtonTextActive
                    ]}>
                      {category.name} {category._count && `(${category._count.faqs})`}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* FAQ Section */}
            <View style={styles.content}>
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>
                  {searchQuery ? 'Search Results' : 'FAQ'}
                </ThemedText>

                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.light.primary} />
                    <ThemedText style={styles.loadingText}>Loading FAQs...</ThemedText>
                  </View>
                ) : error ? (
                  <View style={styles.errorContainer}>
                    <MaterialIcons name="error-outline" size={48} color={Colors.light.danger} />
                    <ThemedText style={styles.errorText}>{error}</ThemedText>
                    <TouchableOpacity style={styles.retryButton} onPress={loadFAQs}>
                      <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.faqContainer}>
                    {filteredFAQ.map((item) => (
                      <View key={item.id} style={styles.faqItem}>
                        <TouchableOpacity
                          style={styles.faqQuestion}
                          onPress={() => toggleFAQ(item.id)}
                          activeOpacity={0.7}
                        >
                          <ThemedText style={styles.questionText}>{item.question}</ThemedText>
                          <MaterialIcons
                            name={expandedFAQ === item.id ? 'expand-less' : 'expand-more'}
                            size={24}
                            color={Colors.light.textSecondary}
                          />
                        </TouchableOpacity>
                        {expandedFAQ === item.id && item.answer ? (
                          <View style={styles.faqAnswer}>
                            <RenderHTML
                              contentWidth={width - 72}
                              source={{ html: item.answer }}
                              baseStyle={styles.answerText}
                            />
                          </View>
                        ) : null}
                      </View>
                    ))}
                    {filteredFAQ.length === 0 && (
                      <View style={styles.noResults}>
                        <MaterialIcons name="search-off" size={48} color={Colors.light.textSecondary} />
                        <ThemedText style={styles.noResultsText}>No questions found</ThemedText>
                        <ThemedText style={styles.noResultsSubtext}>Try searching with different keywords</ThemedText>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
            {!isDesktop && <Footer />}
          </ScrollView>
        ) : (
          <View style={styles.desktopContainer}>
            {/* Header */}
            <View style={[styles.header, { paddingHorizontal: 0 }]}>
              <ThemedText style={styles.title}>Frequently Asked Questions</ThemedText>
              <ThemedText style={styles.subtitle}>
                Find answers to common questions
              </ThemedText>
            </View>

            {/* Customer Care Contact */}
            <View style={[styles.contactContainer, { marginHorizontal: 0 }]}>
              <View style={styles.contactContent}>
                <View style={styles.contactIcon}>
                  <MaterialIcons name="email" size={24} color={Colors.light.primary} />
                </View>
                <View style={styles.contactText}>
                  <ThemedText style={styles.contactTitle}>Need More Help?</ThemedText>
                  <ThemedText style={styles.contactEmail}>{customerCareEmail}</ThemedText>
                  <ThemedText style={styles.contactDescription}>
                    Our customer care team is here to assist you
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Search Bar */}
            <View style={[styles.searchContainer, { paddingHorizontal: 0 }]}>
              <View style={styles.searchInput}>
                <MaterialIcons name="search" size={20} color={Colors.light.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="Search questions..."
                  placeholderTextColor={Colors.light.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>

            {/* Category Filter */}
            <View style={[styles.categoryFilterContainer, { paddingHorizontal: 0 }]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScrollContainer}
              >
                <TouchableOpacity
                  style={[
                    styles.categoryButton,
                    selectedCategory === 'all' && styles.categoryButtonActive
                  ]}
                  onPress={() => setSelectedCategory('all')}
                >
                  <ThemedText style={[
                    styles.categoryButtonText,
                    selectedCategory === 'all' && styles.categoryButtonTextActive
                  ]}>
                    All
                  </ThemedText>
                </TouchableOpacity>

                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryButton,
                      selectedCategory === category.id && styles.categoryButtonActive
                    ]}
                    onPress={() => setSelectedCategory(category.id)}
                  >
                    <ThemedText style={[
                      styles.categoryButtonText,
                      selectedCategory === category.id && styles.categoryButtonTextActive
                    ]}>
                      {category.name} {category._count && `(${category._count.faqs})`}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* FAQ Section */}
            <View style={styles.content}>
              <View style={styles.section}>
                <ThemedText style={[styles.sectionTitle, { paddingHorizontal: 0 }]}>
                  {searchQuery ? 'Search Results' : 'FAQ'}
                </ThemedText>

                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.light.primary} />
                    <ThemedText style={styles.loadingText}>Loading FAQs...</ThemedText>
                  </View>
                ) : error ? (
                  <View style={styles.errorContainer}>
                    <MaterialIcons name="error-outline" size={48} color={Colors.light.danger} />
                    <ThemedText style={styles.errorText}>{error}</ThemedText>
                    <TouchableOpacity style={styles.retryButton} onPress={loadFAQs}>
                      <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={[styles.faqContainer, { paddingHorizontal: 0 }]}>
                    {filteredFAQ.map((item) => (
                      <View key={item.id} style={styles.faqItem}>
                        <TouchableOpacity
                          style={styles.faqQuestion}
                          onPress={() => toggleFAQ(item.id)}
                          activeOpacity={0.7}
                        >
                          <ThemedText style={styles.questionText}>{item.question}</ThemedText>
                          <MaterialIcons
                            name={expandedFAQ === item.id ? 'expand-less' : 'expand-more'}
                            size={24}
                            color={Colors.light.textSecondary}
                          />
                        </TouchableOpacity>
                        {expandedFAQ === item.id && item.answer ? (
                          <View style={styles.faqAnswer}>
                            <RenderHTML
                              contentWidth={width - 72}
                              source={{ html: item.answer }}
                              baseStyle={styles.answerText}
                            />
                          </View>
                        ) : null}
                      </View>
                    ))}
                    {filteredFAQ.length === 0 && (
                      <View style={styles.noResults}>
                        <MaterialIcons name="search-off" size={48} color={Colors.light.textSecondary} />
                        <ThemedText style={styles.noResultsText}>No questions found</ThemedText>
                        <ThemedText style={styles.noResultsSubtext}>Try searching with different keywords</ThemedText>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          </View>
        )}
      </ThemedView>
    </DesktopProfileLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 20,
    flexGrow: 1,
  },
  desktopContainer: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  contactContainer: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.primary,
  },
  contactContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactText: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  contactEmail: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.primary,
    marginBottom: 4,
  },
  contactDescription: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 44,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: Colors.light.text,
    paddingVertical: 12,
    outlineWidth: 0,
    outlineColor: 'transparent',
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  faqContainer: {
    paddingHorizontal: 16,
  },
  faqItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    boxShadow: WebShadows.soft,
    elevation: 1,
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  questionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
    marginRight: 12,
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
    overflow: 'hidden',
  },
  answerText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 22,
  },
  noResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 12,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 16,
    color: Colors.light.danger,
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.light.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  categoryFilterContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  categoryScrollContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    minWidth: 80,
    alignItems: 'center',
  },
  categoryButtonActive: {
    backgroundColor: Colors.light.primary,
  },
  categoryButtonText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
  },
});
