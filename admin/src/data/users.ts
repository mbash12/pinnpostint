export interface UserRecord {
    id: string;
    phone: string;
    email: string;
    firstName: string;
    lastName?: string;
    role: 'ADMIN' | 'USER';
    isActive: boolean;
    isVerified: boolean;
    avatar?: string;
    createdAt: string;
}

// Current logged-in user (admin user)
export const currentUser: UserRecord | null = null;

// Mock users for admin selection
export const mockUsers: UserRecord[] = [];
