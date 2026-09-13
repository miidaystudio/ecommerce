import type { ProductSummary } from '@ecommerce/shared-types';
import { ProductCard } from './ProductCard';

export function ProductRow({
  eyebrow,
  heading,
  products,
}: {
  eyebrow: string;
  heading: string;
  products: ProductSummary[];
}) {
  if (products.length === 0) return null;

  return (
    <section className="border-t border-border pt-10">
      <span className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">{eyebrow}</span>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">{heading}</h2>

      <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
