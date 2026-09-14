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
  phoneNumber: string | null;
  role: UserRole;
  isVerified?: boolean;
  mustChangePassword?: boolean;
}

export interface SessionResponse {
  accessToken: string;
  user: AuthUser;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface RegisterResponse {
  message: string;
  email: string;
  requiresVerification: boolean;
  resendAvailableIn: number;
}

export interface VerifyOtpPayload {
  email: string;
  otp: string;
  /** The account password: binds verification to whoever registered. */
  password: string;
}

export interface ResendOtpPayload {
  email: string;
}

export interface ResendOtpResponse {
  message: string;
  resendAvailableIn: number;
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
  ratingAverage: number;
  ratingCount: number;
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

export const OrderStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PACKED: 'PACKED',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  RETURNED: 'RETURNED',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentMethod = {
  RAZORPAY: 'RAZORPAY',
  COD: 'COD',
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export interface OrderItemView {
  id: string;
  productName: string;
  variantName: string;
  sku: string;
  attributes: Record<string, string> | null;
  imageUrl: string | null;
  price: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderShippingAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  total: number;
  itemCount: number;
  createdAt: string;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  shippingAddress: OrderShippingAddress;
  subtotal: number;
  shippingFee: number;
  discount: number;
  couponCode: string | null;
  total: number;
  /** GST contained in `total` — prices are tax-inclusive, so this is never added on top. 0 for orders placed before tax was tracked. */
  taxAmount: number;
  taxRatePercent: number;
  items: OrderItemView[];
  createdAt: string;
}

/** Server-computed price breakdown; `taxIncluded` is the GST already inside `total`. */
export interface PriceQuote {
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  taxIncluded: number;
  taxRatePercent: number;
}

export interface OrderQuote extends PriceQuote {
  couponCode: string | null;
}

export interface CreateOrderResponse {
  order: OrderDetail;
  // Present only when paymentMethod is RAZORPAY — the storefront uses these
  // to open Razorpay Checkout.js.
  razorpay: { keyId: string; razorpayOrderId: string; amount: number; currency: string } | null;
}

// --- Admin (Phase 5) ---

export interface AdminOrderSummary extends OrderSummary {
  customerEmail: string;
  customerName: string | null;
}

export interface AdminOrderDetail extends OrderDetail {
  customerEmail: string;
  customerName: string | null;
}

export interface PaginatedAdminOrders {
  items: AdminOrderSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface InventoryLineView {
  variantId: string;
  sku: string;
  variantName: string;
  productId: string;
  productName: string;
  stock: number;
  lowStock: boolean;
}

export interface PaginatedInventory {
  items: InventoryLineView[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  lowStockCount: number;
}

export const InventoryAdjustmentReason = {
  ORDER_PLACED: 'ORDER_PLACED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  MANUAL: 'MANUAL',
  RESTOCK: 'RESTOCK',
} as const;

export type InventoryAdjustmentReason = (typeof InventoryAdjustmentReason)[keyof typeof InventoryAdjustmentReason];

export interface AdjustmentView {
  id: string;
  variantId: string;
  change: number;
  reason: InventoryAdjustmentReason;
  orderId: string | null;
  note: string | null;
  createdAt: string;
}

export interface CustomerSummary {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  isBlocked: boolean;
  orderCount: number;
  createdAt: string;
}

export interface CustomerDetail extends CustomerSummary {
  orders: { id: string; orderNumber: string; status: string; total: number; createdAt: string }[];
}

export interface PaginatedCustomers {
  items: CustomerSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// --- Marketing & engagement (Phase 6) ---

export const DiscountType = {
  PERCENTAGE: 'PERCENTAGE',
  FIXED: 'FIXED',
} as const;

export type DiscountType = (typeof DiscountType)[keyof typeof DiscountType];

export interface CouponView {
  id: string;
  code: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount: number | null;
  minOrderValue: number | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  isActive: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface PaginatedCoupons {
  items: CouponView[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AppliedCoupon {
  couponId: string;
  code: string;
  discount: number;
}

export const ReviewStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus];

export interface ReviewView {
  id: string;
  productId: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  authorName: string;
  createdAt: string;
}

export interface AdminReviewView extends ReviewView {
  productName: string;
  authorEmail: string;
}

export interface PaginatedReviews<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProductReviewSummary {
  ratingAverage: number;
  ratingCount: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface BannerView {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  position: number;
  isActive: boolean;
}

export interface DashboardSummary {
  rangeDays: number;
  revenue: number;
  previousRevenue: number;
  orderCount: number;
  newCustomerCount: number;
  avgOrderValue: number;
  lowStockCount: number;
  revenueByDay: { date: string; revenue: number }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    customerEmail: string;
    status: OrderStatus;
    total: number;
    createdAt: string;
  }[];
  topProducts: { productName: string; quantitySold: number; revenue: number }[];
}

export interface CartItemView {
  id: string;
  variantId: string;
  quantity: number;
  price: number;
  compareAtPrice: number | null;
  lineTotal: number;
  stock: number;
  available: boolean;
  product: { id: string; name: string; slug: string };
  variant: { name: string; attributes: Record<string, string> | null };
  image: { url: string; altText: string | null } | null;
}

export interface CartResponse {
  items: CartItemView[];
  subtotal: number;
  itemCount: number;
}

export interface WishlistItemView {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    compareAtPrice: number | null;
    inStock: boolean;
    available: boolean;
  };
  image: { url: string; altText: string | null } | null;
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

// --- Reports (Phase 7) ---

export type ReportGroupBy = 'day' | 'week' | 'month';

export interface SalesReportBucket {
  period: string;
  orderCount: number;
  grossRevenue: number;
  discount: number;
  shipping: number;
  netRevenue: number;
}

export interface SalesReport {
  from: string;
  to: string;
  groupBy: ReportGroupBy;
  totals: {
    orderCount: number;
    grossRevenue: number;
    discount: number;
    shipping: number;
    netRevenue: number;
    avgOrderValue: number;
    unitsSold: number;
  };
  buckets: SalesReportBucket[];
}

export interface BestSellerRow {
  productName: string;
  unitsSold: number;
  revenue: number;
  orderCount: number;
}

export interface BestSellersReport {
  from: string;
  to: string;
  items: BestSellerRow[];
}

export interface CustomerReportRow {
  userId: string;
  email: string;
  name: string | null;
  orderCount: number;
  totalSpend: number;
  avgOrderValue: number;
  firstOrderAt: string;
  lastOrderAt: string;
}

export interface CustomerReport {
  from: string;
  to: string;
  totals: {
    customersWithOrders: number;
    newCustomers: number;
    returningCustomers: number;
    repeatRate: number;
  };
  items: CustomerReportRow[];
}

// --- Store settings & staff (Phase 7) ---

export interface StoreSettingsView {
  storeName: string;
  supportEmail: string;
  supportPhone: string | null;
  addressLine: string | null;
  currency: string;
  freeShippingThreshold: number;
  flatShippingFee: number;
  taxRatePercent: number;
  lowStockThreshold: number;
  ordersEnabled: boolean;
  maintenanceNotice: string | null;
  updatedAt: string | null;
}

/** The storefront-visible subset — no operational thresholds. */
export interface PublicStoreSettings {
  storeName: string;
  supportEmail: string;
  supportPhone: string | null;
  addressLine: string | null;
  currency: string;
  freeShippingThreshold: number;
  flatShippingFee: number;
  ordersEnabled: boolean;
  maintenanceNotice: string | null;
}

/** Only STAFF and SUPER_ADMIN ever appear here — customers are managed elsewhere. */
export type StaffRole = Extract<UserRole, 'STAFF' | 'SUPER_ADMIN'>;

export interface StaffView {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: StaffRole;
  isBlocked: boolean;
  createdAt: string;
}
