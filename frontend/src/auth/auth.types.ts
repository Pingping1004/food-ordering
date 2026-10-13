export enum UserRole {
    user = 'user',
    admin = 'admin',
    cooker = 'cooker',
}

export type RoleRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface RoleRequest {
    requestId: string;
    userId: string;
    requestRole: UserRole;
    status: RoleRequestStatus;
    createdAt: string;
    updatedAt: string | null;
}

export interface User {
    userId: string;
    email: string;
    name?: string;
    restaurant?: {
        restaurantId: string;
        isApproved: boolean;
    };
    profileImg?: string;
    role: UserRole.admin | UserRole.cooker | UserRole.user;
    roleRequest?: RoleRequest | null;
}