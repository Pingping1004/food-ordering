export enum UserRole {
    user = 'user',
    admin = 'admin',
    cooker = 'cooker',
    USER = 'USER',
    ADMIN = 'ADMIN',
    COOKER = 'COOKER',
}

export type RoleRequestStatus = 'pending' | 'accepted' | 'rejected' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface RoleRequest {
    requestId: string;
    userId: string;
    requestRole: UserRole;
    status: RoleRequestStatus;
    createdAt: string;
    updatedAt: string | null;
}

/** schema.prisma `SchoolMembership` as returned inside the profile payload. */
export interface SchoolMembershipLite {
    id?: string;
    role: "ADMIN";
    /** Missing on old payloads → treated as APPROVED. */
    status?: "PENDING" | "APPROVED" | "REJECTED";
    schoolId: string;
    /** Flat fields from `GET /user/profile`. */
    schoolName?: string;
    schoolStatus?: string;
    /** True for the demo-day school (`npm run demo:seed`). */
    schoolIsDemo?: boolean;
    school?: { name: string };
}

/** schema.prisma `RestaurantMembership` as returned inside the profile payload. */
export interface RestaurantMembershipLite {
    id?: string;
    role: "OWNER" | "ADMIN" | "STAFF";
    /** Missing on old payloads → treated as APPROVED. */
    status?: "PENDING" | "APPROVED" | "REJECTED";
    restaurantId: string;
    /** `Restaurant.status` – PENDING until the school admin approves the shop. */
    restaurantStatus?: "PENDING" | "ACTIVE" | "INACTIVE" | "SUSPENDED" | "REMOVED";
    /** Flat fields from `GET /user/profile`. */
    restaurantName?: string;
    canteenName?: string;
    /** True for shops of the demo-day school. */
    restaurantIsDemo?: boolean;
    restaurant?: { name: string; status?: "PENDING" | "ACTIVE" | "INACTIVE" | "SUSPENDED" | "REMOVED"; canteen?: { name: string } };
}

export interface User {
    userId: string;
    email: string;
    name?: string;
    /** Legacy single-restaurant shortcut; new code reads `restaurantMemberships`. */
    restaurant?: {
        restaurantId: string;
        name?: string;
        /** @deprecated replaced by `status` in the new schema */
        isApproved?: boolean;
        status?: "PENDING" | "ACTIVE" | "INACTIVE" | "SUSPENDED" | "REMOVED";
    };
    profileImg?: string;
    /** `Role` enum: the schema is UPPER case, older tokens are lower case – compare with `hasRole()`. */
    role: UserRole;
    /** The school this user belongs to (joined with an invite code). Never carries the invite code itself. */
    school?: { schoolId: string; name: string } | null;
    restaurantMemberships?: RestaurantMembershipLite[];
    schoolMemberships?: SchoolMembershipLite[];
    roleRequest?: RoleRequest | null;
    /** A SHOP_OWNER code was redeemed but the shop is not registered yet → send to the shop registration form. */
    pendingOwnerGrant?: boolean;
    /** Break-glass: a system admin's audited, time-limited write access to one school (null when none). */
    supportGrant?: { schoolId: string; expiresAt: string; reason: string } | null;
}