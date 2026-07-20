import { useState, createContext, useContext, ReactNode } from 'react';
import { Subcategory } from '@/components/ui/subcategory-modal';

interface CategoryContextType {
  selectedCategory: string | null;
  selectedSubcategory: Subcategory | null;
  setSelectedCategory: (category: string | null) => void;
  setSelectedSubcategory: (subcategory: Subcategory | null) => void;
  clearCategorySelection: () => void;
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

export function CategoryProvider({ children }: { children: ReactNode }) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<Subcategory | null>(null);

  const clearCategorySelection = () => {
    setSelectedCategory(null);
    setSelectedSubcategory(null);
  };

  return (
    <CategoryContext.Provider
      value={{
        selectedCategory,
        selectedSubcategory,
        setSelectedCategory,
        setSelectedSubcategory,
        clearCategorySelection
      }}
    >
      {children}
    </CategoryContext.Provider>
  );
}

export function useCategory() {
  const context = useContext(CategoryContext);
  if (context === undefined) {
    throw new Error('useCategory must be used within a CategoryProvider');
  }
  return context;
}