// Backend (Bot) ga so'rov yuborish

export type Category = { id: string; title: string; emoji: string };

// Tarjimalar: { ru: {...}, en: {...} }
export type I18nMap = Partial<Record<'ru' | 'en', Record<string, string | string[]>>>;

export type Branch = {
  id: number;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  phone: string;
  openTime: string;
  closeTime: string;
  tables: number;
};

export type AdminBranch = Branch & {
  i18n: I18nMap;
  radiusKm: number;
  chatId: string;
  isActive: boolean;
};

export type OrderType = 'delivery' | 'dinein';

export type Product = {
  id: string;
  name: string;
  description: string;
  image: string;
  categories: string[];
  oldPrice: number;
  price: number;
  size: string;
  weight: string;
  badge?: string;
  rating: number;
  reviews: string;
  ingredients: string[];
  coinPrice: number | null;
  i18n?: I18nMap;
};

export type Story = {
  id: string;
  title: string;
  emoji: string;
  type: 'promo' | 'review' | 'case';
  gradient: [string, string];
  heading: string;
  text: string;
  rating?: number;
  image?: string;
  cta?: { label: string; action: string };
};

export type AdminStory = {
  id: number;
  title: string;
  emoji: string;
  type: 'promo' | 'review' | 'case';
  gradient: [string, string];
  heading: string;
  text: string;
  rating: number | null;
  ctaLabel: string;
  ctaAction: string;
  image: string;
  hasUpload: boolean;
  i18n: I18nMap;
  sortOrder: number;
  isActive: boolean;
};

export type StoryInput = Partial<Omit<AdminStory, 'id' | 'hasUpload' | 'sortOrder'>> & { imageUpload?: string };

export type BannerTheme = 'red' | 'dark' | 'gold' | 'green';

export type Banner = {
  id: number;
  placement: 'hero' | 'bottom';
  kicker: string;
  title: string;
  subtitle: string;
  image: string;
  ctaLabel: string;
  action: string; // catalog | cart | bonus | details | category:<id> | product:<id> | url:https://...
  theme: BannerTheme;
  details: string;
  i18n?: I18nMap;
  isActive: boolean;
  sortOrder: number;
};

export type OrderBump = {
  id: string;
  title: string;
  description: string;
  oldPrice: number;
  price: number;
};

export type PaymentMethodId = 'stars' | 'provider' | 'crypto' | 'cash';

export type PaymentMethod = {
  id: PaymentMethodId;
  title: string;
  subtitle: string;
  emoji: string;
  enabled: boolean;
};

export type Catalog = {
  brand: { name: string; tagline: string; slogan: string };
  categories: Category[];
  products: Product[];
  stories: Story[];
  banners: Banner[];
  orderBump: OrderBump;
  delivery: { fee: number; freeFrom: number };
  starsRate: number;
  supportUsername: string;
  settings: AppSettings;
  branches: Branch[];
  paymentMethods: PaymentMethod[];
};

export type AppSettings = { coinsEnabled: boolean; coinsPerThousand: number; bannerInterval: number };

export type Role = 'owner' | 'manager' | 'cook' | 'courier' | 'customer';
export type Perm = 'orders' | 'stats' | 'menu' | 'ads' | 'branches' | 'staff' | 'settings';

export type Address = {
  id: number;
  label: string;
  address: string;
  apartment: string;
  entrance: string;
  floor: string;
  note: string;
  lat: number | null;
  lng: number | null;
  isDefault: boolean;
};

export type AddressInput = Omit<Address, 'id' | 'isDefault'> & { isDefault?: boolean };

export type CoinsInfo = {
  enabled: boolean;
  perThousand: number;
  balance: number;
  history: Array<{ amount: number; type: string; orderId: number | null; note: string; createdAt: string }>;
};

export type StaffMember = {
  telegramId: string;
  name: string;
  username: string;
  phone: string;
  role: Role;
  roleTitle: string;
  editable: boolean;
  branchId?: number | null;
};

export type Me = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  photoUrl: string;
  fullName: string;
  phone: string;
  ordersCount: number;
  memberSince: string;
  isAdmin?: boolean;
  role: Role;
  roleTitle: string;
  perms: Perm[];
  coins: number;
  coinsEnabled: boolean;
  lang: 'uz' | 'ru' | 'en' | null; // null — foydalanuvchi hali til tanlamagan
  avatar: string;
  branchId: number | null;
};

export type OrderPayload = {
  items: Array<{ productId: string; qty: number }>;
  rewards: Array<{ productId: string; qty: number }>;
  bumpAdded: boolean;
  paymentMethod: PaymentMethodId;
  fullName: string;
  phone: string;
  orderType: OrderType;
  addressId?: number;
  branchId?: number;
  tableNo?: number;
  comment?: string;
};

export type OrderResponse = {
  orderId: number;
  total: number;
  totalStars: number;
  invoiceLink?: string;
  branch?: { id: number; name: string };
};

export type OrderHistoryItem = {
  id: number;
  orderType?: OrderType;
  tableNo?: string | null;
  branchName?: string;
  total: number;
  status: string;
  statusTitle: string;
  paymentMethod: PaymentMethodId;
  paymentStatus: string;
  paymentStatusTitle: string;
  items: Array<{ productId: string; name: string; qty: number; lineTotal: number; reward?: boolean }>;
  coinsSpent?: number;
  coinsEarned?: number;
  createdAt: string;
};

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getInitData(): string {
  if (typeof window === 'undefined') return '';
  return window.Telegram?.WebApp?.initData || '';
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const initData = getInitData();
  if (initData) headers.Authorization = `tma ${initData}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  } catch {
    throw new ApiError('Internet aloqasini tekshiring', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError((data as { error?: string }).error || 'Server xatosi', res.status);
  }
  return data as T;
}

// ---------- Admin ----------
export type OrderStatus = 'new' | 'accepted' | 'ready' | 'delivering' | 'done' | 'cancelled';

export type AdminOrder = {
  id: number;
  customerName: string;
  username: string;
  telegramId: string;
  phone: string;
  address: string;
  comment: string;
  items: Array<{ productId: string; name: string; qty: number; lineTotal: number; reward?: boolean; coinPrice?: number }>;
  bumpAdded: boolean;
  bumpTitle: string;
  nextStatuses: Array<{ status: OrderStatus; title: string }>;
  orderType: OrderType;
  tableNo: string;
  branchId: number | null;
  branchName: string;
  coinsSpent: number;
  mapUrl: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  totalStars: number;
  paymentMethod: PaymentMethodId;
  paymentTitle: string;
  paymentStatus: string;
  paymentStatusTitle: string;
  status: OrderStatus;
  statusTitle: string;
  createdAt: string;
};

export type AdminStats = {
  today: { day: string; revenue: number; orders: number };
  week: { revenue: number; orders: number; avgCheck: number };
  totals: { orders: number; revenue: number; customers: number };
  daily: Array<{ day: string; revenue: number; orders: number }>;
  statuses: Partial<Record<OrderStatus, number>>;
  top: Array<{ name: string; qty: number; revenue: number }>;
};

export type AdminProduct = Product & { isActive: boolean; sortOrder: number };

export type AdminCategory = Category & { i18n: I18nMap; sortOrder: number; isActive: boolean; products?: number };

export type ProductInput = Partial<
  Pick<
    AdminProduct,
    'name' | 'description' | 'image' | 'categories' | 'oldPrice' | 'price' | 'badge' | 'size' | 'weight' | 'ingredients' | 'isActive' | 'coinPrice' | 'i18n'
  >
>;

export const api = {
  getCatalog: (lang: string) => request<Catalog>(`/catalog?lang=${lang}`),
  setLang: (lang: string) => request<{ lang: string }>('/me/lang', { method: 'PATCH', body: JSON.stringify({ lang }) }),
  setAvatar: (avatar: string | null) => request<{ avatar: string }>('/me/avatar', { method: 'PUT', body: JSON.stringify({ avatar }) }),
  detectBranch: (lat: number, lng: number) =>
    request<{ branchId: number | null; distanceKm?: number; inside: boolean }>('/branches/detect', {
      method: 'POST',
      body: JSON.stringify({ lat, lng }),
    }),
  getMe: () => request<Me>('/me'),
  getOrders: () => request<OrderHistoryItem[]>('/orders'),
  createOrder: (payload: OrderPayload) =>
    request<OrderResponse>('/orders', { method: 'POST', body: JSON.stringify(payload) }),
  updateMe: (data: { fullName: string; phone: string }) =>
    request<{ fullName: string; phone: string }>('/me', { method: 'PATCH', body: JSON.stringify(data) }),
  addresses: () => request<Address[]>('/addresses'),
  createAddress: (data: AddressInput) => request<Address>('/addresses', { method: 'POST', body: JSON.stringify(data) }),
  updateAddress: (id: number, data: AddressInput) =>
    request<Address>(`/addresses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  setDefaultAddress: (id: number) => request<Address>(`/addresses/${id}/default`, { method: 'POST' }),
  deleteAddress: (id: number) => request<{ ok: true }>(`/addresses/${id}`, { method: 'DELETE' }),
  geocode: (lat: number, lng: number) =>
    request<{ address: string; lat: number; lng: number }>('/geocode', { method: 'POST', body: JSON.stringify({ lat, lng }) }),
  coins: () => request<CoinsInfo>('/coins'),

  admin: {
    stats: () => request<AdminStats>('/admin/stats'),
    orders: (status: OrderStatus | 'all', branch?: number | null) =>
      request<AdminOrder[]>(`/admin/orders?status=${status}${branch ? `&branch=${branch}` : ''}`),
    branches: () => request<{ branches: AdminBranch[]; botUsername: string }>('/admin/branches'),
    stories: () => request<AdminStory[]>('/admin/stories'),
    createStory: (data: StoryInput) => request<AdminStory>('/admin/stories', { method: 'POST', body: JSON.stringify(data) }),
    updateStory: (id: number, data: StoryInput) =>
      request<AdminStory>(`/admin/stories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    reorderStories: (ids: number[]) =>
      request<AdminStory[]>('/admin/stories/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),
    deleteStory: (id: number) => request<{ ok: true }>(`/admin/stories/${id}`, { method: 'DELETE' }),
    categories: () => request<AdminCategory[]>('/admin/categories'),
    createCategory: (data: Partial<AdminCategory>) =>
      request<AdminCategory>('/admin/categories', { method: 'POST', body: JSON.stringify(data) }),
    updateCategory: (id: string, data: Partial<AdminCategory>) =>
      request<AdminCategory>(`/admin/categories/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteCategory: (id: string) => request<{ ok: true }>(`/admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    createBranch: (data: Record<string, unknown>) =>
      request<AdminBranch>('/admin/branches', { method: 'POST', body: JSON.stringify(data) }),
    updateBranch: (id: number, data: Record<string, unknown>) =>
      request<AdminBranch>(`/admin/branches/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteBranch: (id: number) => request<{ ok: true; keptOrders: number }>(`/admin/branches/${id}`, { method: 'DELETE' }),
    setStatus: (id: number, status: OrderStatus) =>
      request<{ id: number; status: OrderStatus; statusTitle: string }>(`/admin/orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    products: () => request<{ products: AdminProduct[]; categories: Category[] }>('/admin/products'),
    updateProduct: (id: string, data: ProductInput) =>
      request<AdminProduct>(`/admin/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
    createProduct: (data: ProductInput) =>
      request<AdminProduct>('/admin/products', { method: 'POST', body: JSON.stringify(data) }),
    banners: () => request<Banner[]>('/admin/banners'),
    createBanner: (data: Partial<Banner>) =>
      request<Banner>('/admin/banners', { method: 'POST', body: JSON.stringify(data) }),
    updateBanner: (id: number, data: Partial<Banner>) =>
      request<Banner>(`/admin/banners/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    staff: () => request<{ staff: StaffMember[]; roles: Array<{ id: Role; title: string; perms: Perm[] }> }>('/admin/staff'),
    invite: (role: Role, branchId: number | null) =>
      request<{ link: string; roleTitle: string; branchName: string; expiresInDays: number }>('/admin/staff/invites', {
        method: 'POST',
        body: JSON.stringify({ role, branchId }),
      }),
    setRole: (telegramId: string, role: Role) =>
      request<{ role: Role }>(`/admin/staff/${telegramId}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    setStaffBranch: (telegramId: string, branchId: number | null) =>
      request<{ branchId: number | null }>(`/admin/staff/${telegramId}`, { method: 'PATCH', body: JSON.stringify({ branchId }) }),
    settings: () => request<AppSettings>('/admin/settings'),
    updateSettings: (data: Partial<AppSettings>) =>
      request<AppSettings>('/admin/settings', { method: 'PATCH', body: JSON.stringify(data) }),
  },
};
