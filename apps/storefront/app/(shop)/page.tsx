import type { ProductSummary } from '@ecommerce/shared-types';
import { productsApi } from '../../lib/api/products.api';
import { EditorialLanding } from '../../components/landing/EditorialLanding';

export const revalidate = 60;

export default async function HomePage() {
  let products: ProductSummary[] = [];
  try {
    const res = await productsApi.list({ sort: 'newest', pageSize: 6 });
    products = res.items;
  } catch {
    products = [];
  }

  return <EditorialLanding initialProducts={products} />;
}
