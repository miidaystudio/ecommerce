'use client';

import { ProductForm } from '../../../../components/product/ProductForm';

export default function NewProductPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Add product</h1>
        <p className="mt-1.5 text-xs text-text-secondary">
          Create the product first — image upload becomes available once it&apos;s saved.
        </p>
      </div>
      <ProductForm mode="create" />
    </div>
  );
}
