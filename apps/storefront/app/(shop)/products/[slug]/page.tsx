import { notFound } from 'next/navigation';
import { productsApi } from '../../../../lib/api/products.api';
import { ApiError } from '../../../../lib/api/client';
import { ProductDetailView } from '../../../../components/product/ProductDetailView';

interface ProductDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;

  try {
    const product = await productsApi.getBySlug(slug);
    return <ProductDetailView product={product} />;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="text-sm text-danger">
          {error instanceof ApiError ? error.message : 'Unable to load this product right now.'}
        </p>
      </div>
    );
  }
}
