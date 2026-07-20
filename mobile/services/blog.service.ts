import apiService from './api.service';

export interface Blog {
    id: string;
    title: string;
    slug: string;
    content: string;
    excerpt?: string;
    imageUrl?: string;
    isFeatured: boolean;
    publishedAt: string;
    author?: {
        firstName: string;
        lastName: string;
    };
    category?: {
        id: string;
        name: string;
        slug: string;
    };
}

export interface BlogCategory {
    id: string;
    name: string;
    slug: string;
    description?: string;
    order: number;
}

export interface BlogListResponse {
    success: boolean;
    data: Blog[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export interface BlogDetailResponse {
    success: boolean;
    data: Blog;
}

export const blogService = {
    getBlogs: async (page = 1, limit = 10, search?: string, categoryId?: string) => {
        // The API returns the response directly without wrapping in standard ApiResponse format
        const params: any = { page, limit };
        if (search) params.search = search;
        if (categoryId) params.categoryId = categoryId;
        return apiService.get('/public/blogs', params) as Promise<{
            success: boolean;
            data: Blog[];
            pagination: {
                page: number;
                limit: number;
                total: number;
                pages: number;
            };
        }>;
    },

    getBlogDetail: async (idOrSlug: string) => {
        return apiService.get<Blog>(`/public/blogs/${idOrSlug}`);
    },

    getBlogCategories: async () => {
        return apiService.get('/public/blog-categories') as Promise<{
            success: boolean;
            data: BlogCategory[];
        }>;
    }
};
