import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { NetworkImage } from '@/components/ui/network-image';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors, WebShadows } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { BaseBottomSheet } from '@/components/ui/base-bottom-sheet';
import { categoriesService, Subcategory as ApiSubcategory } from '@/services/categories.service';

export interface Subcategory {
  id: string;
  name: string;
  description: string;
  image: string;
}

export interface SubcategoryModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectSubcategory: (subcategory: Subcategory, categoryName: string) => void;
  categoryName: string;
  categoryId: string;
}

export function SubcategoryModal({
  visible,
  onClose,
  onSelectSubcategory,
  categoryName,
  categoryId
}: SubcategoryModalProps) {
  const [subcategories, setSubcategories] = useState<ApiSubcategory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && categoryId) {
      fetchSubcategories();
    }
  }, [visible, categoryId]);

  const fetchSubcategories = async () => {
    try {
      setLoading(true);
      const response = await categoriesService.getCategorySubcategories(categoryId);
      if (response.success && response.data) {
        setSubcategories(response.data);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleSubcategoryPress = (subcategory: ApiSubcategory) => {
    const mappedSubcategory: Subcategory = {
      id: subcategory.id,
      name: subcategory.name,
      description: subcategory.description || '',
      image: subcategory.image || ''
    };
    onSelectSubcategory(mappedSubcategory, categoryName);
    onClose();
  };

  return (
    <BaseBottomSheet
      visible={visible}
      onClose={onClose}
      title={`Select ${categoryName}`}
      backdropOpacity={0.4}
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <ThemedText style={styles.loadingText}>Loading subcategories...</ThemedText>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.subcategoriesList}>
            {subcategories.map((subcategory) => (
              <TouchableOpacity
                key={subcategory.id}
                style={styles.subcategoryCard}
                onPress={() => handleSubcategoryPress(subcategory)}
                activeOpacity={0.7}
              >
                {subcategory.image ? (
                  <NetworkImage
                    source={{ uri: subcategory.image }}
                    style={styles.subcategoryImage}
                  />
                ) : (
                  <View style={[styles.subcategoryImage, { backgroundColor: Colors.light.backgroundSecondary }]} />
                )}
                <View style={styles.subcategoryInfo}>
                  <ThemedText style={styles.subcategoryName}>{subcategory.name}</ThemedText>
                  <ThemedText style={styles.subcategoryDescription}>
                    {subcategory.description || ''}
                  </ThemedText>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>

          {subcategories.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialIcons name="category" size={64} color={Colors.light.textSecondary} />
              <ThemedText style={styles.emptyText}>No subcategories available</ThemedText>
            </View>
          )}
        </ScrollView>
      )}
    </BaseBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  subcategoriesList: {
    padding: 20,
  },
  subcategoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: WebShadows.soft,
    elevation: 1,
  },
  subcategoryImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 16,
  },
  subcategoryInfo: {
    flex: 1,
  },
  subcategoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  subcategoryDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginTop: 12,
  },
});
