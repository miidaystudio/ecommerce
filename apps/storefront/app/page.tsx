import Link from 'next/link';
import { productsApi } from '../lib/api/products.api';
import { ApiError } from '../lib/api/client';
import { ProductCard } from '../components/product/ProductCard';

// Revalidate periodically so newly published/priced products show up without a rebuild.
export const revalidate = 60;

export default async function HomePage() {
  let featured: Awaited<ReturnType<typeof productsApi.list>> | null = null;
  let error = '';

  try {
    featured = await productsApi.list({ sort: 'newest', pageSize: 8 });
  } catch (err) {
    error = err instanceof ApiError ? err.message : 'Unable to load featured products right now.';
  }

  return (
    <main className="flex min-h-screen flex-col">
      <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-4 py-20 text-center">
        <span className="w-fit rounded-full bg-surface px-3 py-1 font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
          New season · linen &amp; oak
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
          miiday<span className="text-accent">.</span>
        </h1>
        <p className="max-w-prose text-md leading-relaxed text-text-secondary">
          Everything for a slower home — shop across multiple product categories.
        </p>
        <Link
          href="/products"
          className="mt-2 inline-flex h-11 items-center justify-center rounded bg-primary px-6 text-base font-medium text-primary-foreground transition hover:bg-primary-hover"
        >
          Shop all products
        </Link>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <span className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
              Just landed
            </span>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">
              Featured products
            </h2>
          </div>
          <Link href="/products" className="text-sm font-medium text-primary hover:text-primary-hover">
            View all
          </Link>
        </div>

        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : featured && featured.items.length > 0 ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {featured.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">No products available yet.</p>
        )}
      </section>
    </main>
  );
}
