import type { Metadata } from 'next';
import { productsApi, type ListProductsParams } from '../../../lib/api/products.api';
import { catalogApi } from '../../../lib/api/catalog.api';
import { ApiError } from '../../../lib/api/client';
import { ProductCard } from '../../../components/product/ProductCard';
import { ProductFilters } from '../../../components/product/ProductFilters';
import { SortSelect } from '../../../components/product/SortSelect';
import { Pagination } from '../../../components/product/Pagination';

export const metadata: Metadata = {
  title: 'Shop — miiday',
};

interface ProductsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const SORT_VALUES = new Set(['newest', 'price_asc', 'price_desc']);

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const resolvedParams = await searchParams;

  const category = firstValue(resolvedParams.category);
  const brand = firstValue(resolvedParams.brand);
  const minPrice = firstValue(resolvedParams.minPrice);
  const maxPrice = firstValue(resolvedParams.maxPrice);
  const inStock = firstValue(resolvedParams.inStock);
  const sortParam = firstValue(resolvedParams.sort);
  const sort = (SORT_VALUES.has(sortParam ?? '') ? sortParam : 'newest') as ListProductsParams['sort'];
  const q = firstValue(resolvedParams.q);
  const pageParam = firstValue(resolvedParams.page);
  const page = Math.max(1, Number(pageParam) || 1);

  const currentParams: Record<string, string | undefined> = {
    category,
    brand,
    minPrice,
    maxPrice,
    inStock,
    sort,
    q,
  };

  let productsResult: Awaited<ReturnType<typeof productsApi.list>> | null = null;
  let categories: Awaited<ReturnType<typeof catalogApi.listCategories>> = [];
  let brands: Awaited<ReturnType<typeof catalogApi.listBrands>> = [];
  let loadError = '';

  try {
    const [productsRes, categoriesRes, brandsRes] = await Promise.all([
      productsApi.list({
        page,
        pageSize: 12,
        category,
        brand,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        inStock: inStock === 'true' ? true : undefined,
        sort,
        q,
      }),
      catalogApi.listCategories(),
      catalogApi.listBrands(),
    ]);
    productsResult = productsRes;
    categories = categoriesRes;
    brands = brandsRes;
  } catch (error) {
    loadError = error instanceof ApiError ? error.message : 'Unable to load products right now.';
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <span className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">Shop</span>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">
          {q ? `Results for "${q}"` : 'All products'}
        </h1>
      </div>

      {loadError ? (
        <p className="text-sm text-danger">{loadError}</p>
      ) : (
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[220px_1fr]">
          <ProductFilters categories={categories} brands={brands} currentParams={currentParams} />

          <div>
            <div className="mb-6 flex items-center justify-between gap-4">
              <p className="text-sm text-text-secondary">{productsResult?.total ?? 0} products</p>
              <SortSelect currentParams={currentParams} />
            </div>

            {productsResult && productsResult.items.length > 0 ? (
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {productsResult.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-secondary">No products match these filters.</p>
            )}

            {productsResult ? (
              <Pagination
                currentPage={productsResult.page}
                totalPages={productsResult.totalPages}
                currentParams={currentParams}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
