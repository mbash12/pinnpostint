// FAQ Types
export interface FAQ {
  id: string;
  question: string;
  answer: string;
  isActive: boolean;
  order: number;
  categoryId?: string;
  category?: FAQCategory;
  createdAt: string;
  updatedAt: string;
}

export interface FAQCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    faqs: number;
  };
}

export interface CreateFAQRequest {
  question: string;
  answer: string;
  isActive?: boolean;
  order?: number;
  categoryId?: string;
}

export interface UpdateFAQRequest {
  question?: string;
  answer?: string;
  isActive?: boolean;
  order?: number;
  categoryId?: string | null;
}

export interface CreateFAQCategoryRequest {
  name: string;
  slug?: string;
  description?: string;
  isActive?: boolean;
  order?: number;
}

export interface UpdateFAQCategoryRequest {
  name?: string;
  slug?: string;
  description?: string | null;
  isActive?: boolean;
  order?: number;
}