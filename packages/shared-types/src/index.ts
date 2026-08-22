export const UserRole = {
  CUSTOMER: 'CUSTOMER',
  STAFF: 'STAFF',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: UserRole;
}

export interface SessionResponse {
  accessToken: string;
  user: AuthUser;
}

export interface UserAddress {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export const ProductStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus];

export interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
}

export interface ProductImage {
  id: string;
  url: string;
  altText: string | null;
  position: number;
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  attributes: Record<string, string> | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  isDefault: boolean;
}

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  category: Pick<Category, 'id' | 'name' | 'slug'>;
  brand: Pick<Brand, 'id' | 'name' | 'slug'> | null;
  image: ProductImage | null;
  price: number;
  compareAtPrice: number | null;
  inStock: boolean;
}

export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: ProductStatus;
  category: Pick<Category, 'id' | 'name' | 'slug'>;
  brand: Pick<Brand, 'id' | 'name' | 'slug'> | null;
  images: ProductImage[];
  variants: ProductVariant[];
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  database: 'up' | 'down';
}
