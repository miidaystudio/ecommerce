'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Brand, Category, ProductDetail, ProductStatus } from '@ecommerce/shared-types';
import { Button } from '../ui/Button';
import { FormField } from '../ui/FormField';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { ApiError } from '../../lib/api/client';
import { catalogApi } from '../../lib/api/catalog.api';
import { productsApi, type CreateProductPayload } from '../../lib/api/products.api';
import { productFormSchema, type ProductFormInput, type VariantFormInput } from '../../lib/validators/product.schema';
import { slugify } from '../../lib/utils/slugify';
import { resolveImageUrl } from '../../lib/utils/image-url';

const STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
];

let uidCounter = 0;
function nextUid(): string {
  uidCounter += 1;
  return `variant-${uidCounter}-${Date.now()}`;
}

function emptyVariant(isDefault: boolean): VariantFormInput {
  return {
    uid: nextUid(),
    sku: '',
    name: '',
    attributes: [],
    price: '',
    compareAtPrice: '',
    stock: '',
    isDefault,
  };
}

function initialFormValues(product?: ProductDetail): ProductFormInput {
  if (product) {
    return {
      name: product.name,
      slug: product.slug,
      description: product.description,
      status: product.status,
      categoryId: product.category.id,
      brandId: product.brand?.id ?? '',
      seoTitle: product.seoTitle ?? '',
      seoDescription: product.seoDescription ?? '',
      variants: product.variants.length
        ? product.variants.map((v) => ({
            uid: nextUid(),
            id: v.id,
            sku: v.sku,
            name: v.name,
            attributes: v.attributes ? Object.entries(v.attributes).map(([key, value]) => ({ key, value })) : [],
            price: String(v.price),
            compareAtPrice: v.compareAtPrice !== null ? String(v.compareAtPrice) : '',
            stock: String(v.stock),
            isDefault: v.isDefault,
          }))
        : [emptyVariant(true)],
    };
  }
  return {
    name: '',
    slug: '',
    description: '',
    status: 'DRAFT',
    categoryId: '',
    brandId: '',
    seoTitle: '',
    seoDescription: '',
    variants: [emptyVariant(true)],
  };
}

interface ProductFormProps {
  mode: 'create' | 'edit';
  product?: ProductDetail;
}

export function ProductForm({ mode, product }: ProductFormProps) {
  const router = useRouter();

  const [form, setForm] = useState<ProductFormInput>(() => initialFormValues(product));
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [currentProduct, setCurrentProduct] = useState<ProductDetail | undefined>(product);

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');

  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);

  const [newBrandName, setNewBrandName] = useState('');
  const [creatingBrand, setCreatingBrand] = useState(false);
  const [brandError, setBrandError] = useState('');
  const [showNewBrand, setShowNewBrand] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [imageError, setImageError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      setCatalogLoading(true);
      setCatalogError('');
      try {
        const [cats, brs] = await Promise.all([catalogApi.listCategories(), catalogApi.listBrands()]);
        if (!cancelled) {
          setCategories(cats);
          setBrands(brs);
        }
      } catch (error) {
        if (!cancelled) {
          setCatalogError(error instanceof ApiError ? error.message : 'Failed to load categories/brands');
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }
    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleNameChange(value: string) {
    setForm((prev) => ({
      ...prev,
      name: value,
      slug: slugTouched ? prev.slug : slugify(value),
    }));
  }

  function handleSlugChange(value: string) {
    setSlugTouched(true);
    setForm((prev) => ({ ...prev, slug: value }));
  }

  function updateVariant(uid: string, patch: Partial<VariantFormInput>) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => (v.uid === uid ? { ...v, ...patch } : v)),
    }));
  }

  function addVariant() {
    setForm((prev) => ({ ...prev, variants: [...prev.variants, emptyVariant(prev.variants.length === 0)] }));
  }

  function removeVariant(uid: string) {
    setForm((prev) => {
      if (prev.variants.length <= 1) return prev;
      const removingDefault = prev.variants.find((v) => v.uid === uid)?.isDefault;
      const remaining = prev.variants.filter((v) => v.uid !== uid);
      if (removingDefault && remaining.length > 0 && !remaining.some((v) => v.isDefault)) {
        remaining[0] = { ...remaining[0], isDefault: true };
      }
      return { ...prev, variants: remaining };
    });
  }

  function setDefaultVariant(uid: string) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => ({ ...v, isDefault: v.uid === uid })),
    }));
  }

  function addAttribute(uid: string) {
    updateVariantAttributes(uid, (attrs) => [...attrs, { key: '', value: '' }]);
  }

  function updateAttribute(uid: string, index: number, patch: Partial<{ key: string; value: string }>) {
    updateVariantAttributes(uid, (attrs) => attrs.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function removeAttribute(uid: string, index: number) {
    updateVariantAttributes(uid, (attrs) => attrs.filter((_, i) => i !== index));
  }

  function updateVariantAttributes(
    uid: string,
    updater: (attrs: { key: string; value: string }[]) => { key: string; value: string }[],
  ) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => (v.uid === uid ? { ...v, attributes: updater(v.attributes) } : v)),
    }));
  }

  async function handleCreateCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    setCreatingCategory(true);
    setCategoryError('');
    try {
      const category = await catalogApi.createCategory({ name });
      setCategories((prev) => [...prev, category]);
      setForm((prev) => ({ ...prev, categoryId: category.id }));
      setNewCategoryName('');
      setShowNewCategory(false);
    } catch (error) {
      setCategoryError(error instanceof ApiError ? error.message : 'Failed to create category');
    } finally {
      setCreatingCategory(false);
    }
  }

  async function handleCreateBrand() {
    const name = newBrandName.trim();
    if (!name) return;
    setCreatingBrand(true);
    setBrandError('');
    try {
      const brand = await catalogApi.createBrand({ name });
      setBrands((prev) => [...prev, brand]);
      setForm((prev) => ({ ...prev, brandId: brand.id }));
      setNewBrandName('');
      setShowNewBrand(false);
    } catch (error) {
      setBrandError(error instanceof ApiError ? error.message : 'Failed to create brand');
    } finally {
      setCreatingBrand(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setFormSuccess('');

    const parsed = productFormSchema.safeParse(form);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[issue.path.join('.')] = issue.message;
      }
      setFieldErrors(errors);
      setFormError('Please fix the highlighted fields.');
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const payload: CreateProductPayload = {
        name: parsed.data.name,
        slug: parsed.data.slug || undefined,
        description: parsed.data.description,
        status: parsed.data.status,
        categoryId: parsed.data.categoryId,
        brandId: parsed.data.brandId || undefined,
        seoTitle: parsed.data.seoTitle || undefined,
        seoDescription: parsed.data.seoDescription || undefined,
        variants: parsed.data.variants.map((v) => {
          const attributes = v.attributes.reduce<Record<string, string>>((acc, row) => {
            if (row.key) acc[row.key] = row.value;
            return acc;
          }, {});
          return {
            id: v.id,
            sku: v.sku,
            name: v.name,
            attributes: Object.keys(attributes).length ? attributes : undefined,
            price: v.price,
            compareAtPrice: v.compareAtPrice,
            stock: v.stock,
            isDefault: v.isDefault,
          };
        }),
      };

      if (mode === 'edit' && currentProduct) {
        const updated = await productsApi.update(currentProduct.id, payload);
        setCurrentProduct(updated);
        setFormSuccess('Product updated.');
      } else {
        const created = await productsApi.create(payload);
        router.push(`/products/${created.id}/edit`);
        return;
      }
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !currentProduct) return;
    setImageError('');
    setUploadingImage(true);
    try {
      const updated = await productsApi.uploadImage(currentProduct.id, file);
      setCurrentProduct(updated);
    } catch (error) {
      setImageError(error instanceof ApiError ? error.message : 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleImageDelete(imageId: string) {
    if (!currentProduct) return;
    setImageError('');
    setDeletingImageId(imageId);
    try {
      const updated = await productsApi.removeImage(currentProduct.id, imageId);
      setCurrentProduct(updated);
    } catch (error) {
      setImageError(error instanceof ApiError ? error.message : 'Failed to delete image');
    } finally {
      setDeletingImageId(null);
    }
  }

  async function handleDeleteProduct() {
    if (!currentProduct) return;
    const confirmed = window.confirm(`Delete "${currentProduct.name}"? This cannot be undone.`);
    if (!confirmed) return;
    setDeleting(true);
    setFormError('');
    try {
      await productsApi.remove(currentProduct.id);
      router.push('/products');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Failed to delete product');
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <section className="rounded-lg border border-border bg-background p-6">
        <h2 className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">Details</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Name"
            id="name"
            value={form.name}
            onChange={(e) => handleNameChange(e.target.value)}
            error={fieldErrors.name}
          />
          <FormField
            label="Slug"
            id="slug"
            value={form.slug ?? ''}
            onChange={(e) => handleSlugChange(e.target.value)}
            error={fieldErrors.slug}
            placeholder="auto-generated from name"
          />
        </div>
        <div className="mt-4">
          <Textarea
            label="Description"
            id="description"
            rows={5}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            error={fieldErrors.description}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Select
              label="Category"
              id="categoryId"
              value={form.categoryId}
              onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value }))}
              error={fieldErrors.categoryId}
              disabled={catalogLoading}
            >
              <option value="">{catalogLoading ? 'Loading…' : 'Select a category'}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            {!showNewCategory ? (
              <button
                type="button"
                onClick={() => setShowNewCategory(true)}
                className="mt-1.5 text-xs font-medium text-primary hover:text-primary-hover"
              >
                + New category
              </button>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name"
                  className="h-9 flex-1 rounded border border-border px-2.5 text-sm text-text-primary outline-none focus:border-primary"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 px-3 text-xs"
                  disabled={creatingCategory}
                  onClick={handleCreateCategory}
                >
                  {creatingCategory ? 'Adding…' : 'Add'}
                </Button>
              </div>
            )}
            {categoryError ? <p className="mt-1 text-xs text-danger">{categoryError}</p> : null}
          </div>

          <div>
            <Select
              label="Brand"
              id="brandId"
              value={form.brandId ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, brandId: e.target.value }))}
              disabled={catalogLoading}
            >
              <option value="">No brand</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            {!showNewBrand ? (
              <button
                type="button"
                onClick={() => setShowNewBrand(true)}
                className="mt-1.5 text-xs font-medium text-primary hover:text-primary-hover"
              >
                + New brand
              </button>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="Brand name"
                  className="h-9 flex-1 rounded border border-border px-2.5 text-sm text-text-primary outline-none focus:border-primary"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 px-3 text-xs"
                  disabled={creatingBrand}
                  onClick={handleCreateBrand}
                >
                  {creatingBrand ? 'Adding…' : 'Add'}
                </Button>
              </div>
            )}
            {brandError ? <p className="mt-1 text-xs text-danger">{brandError}</p> : null}
          </div>

          <Select
            label="Status"
            id="status"
            value={form.status}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ProductStatus }))}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
        {catalogError ? <p className="mt-3 text-xs text-danger">{catalogError}</p> : null}
      </section>

      <section className="rounded-lg border border-border bg-background p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">Variants</h2>
          <Button type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={addVariant}>
            + Add variant
          </Button>
        </div>
        {fieldErrors.variants ? <p className="mt-2 text-xs text-danger">{fieldErrors.variants}</p> : null}

        <div className="mt-4 flex flex-col gap-4">
          {form.variants.map((variant, index) => (
            <div key={variant.uid} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
                  Variant {index + 1}
                </span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-text-primary">
                    <input
                      type="radio"
                      name="defaultVariant"
                      checked={variant.isDefault}
                      onChange={() => setDefaultVariant(variant.uid)}
                    />
                    Default variant
                  </label>
                  <button
                    type="button"
                    onClick={() => removeVariant(variant.uid)}
                    disabled={form.variants.length <= 1}
                    className="text-xs font-medium text-danger disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FormField
                  label="SKU"
                  value={variant.sku}
                  onChange={(e) => updateVariant(variant.uid, { sku: e.target.value })}
                  error={fieldErrors[`variants.${index}.sku`]}
                />
                <FormField
                  label="Variant name"
                  value={variant.name}
                  onChange={(e) => updateVariant(variant.uid, { name: e.target.value })}
                  error={fieldErrors[`variants.${index}.name`]}
                />
                <FormField
                  label="Price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={variant.price}
                  onChange={(e) => updateVariant(variant.uid, { price: e.target.value })}
                  error={fieldErrors[`variants.${index}.price`]}
                />
                <FormField
                  label="Compare-at price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={variant.compareAtPrice ?? ''}
                  onChange={(e) => updateVariant(variant.uid, { compareAtPrice: e.target.value })}
                  error={fieldErrors[`variants.${index}.compareAtPrice`]}
                />
                <FormField
                  label="Stock"
                  type="number"
                  min="0"
                  step="1"
                  value={variant.stock}
                  onChange={(e) => updateVariant(variant.uid, { stock: e.target.value })}
                  error={fieldErrors[`variants.${index}.stock`]}
                />
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-primary">Attributes</span>
                  <button
                    type="button"
                    onClick={() => addAttribute(variant.uid)}
                    className="text-xs font-medium text-primary hover:text-primary-hover"
                  >
                    + Add attribute
                  </button>
                </div>
                {variant.attributes.length > 0 ? (
                  <div className="mt-2 flex flex-col gap-2">
                    {variant.attributes.map((attr, attrIndex) => (
                      <div key={attrIndex} className="flex items-center gap-2">
                        <input
                          value={attr.key}
                          onChange={(e) => updateAttribute(variant.uid, attrIndex, { key: e.target.value })}
                          placeholder="e.g. Size"
                          className="h-9 flex-1 rounded border border-border bg-background px-2.5 text-sm text-text-primary outline-none focus:border-primary"
                        />
                        <input
                          value={attr.value}
                          onChange={(e) => updateAttribute(variant.uid, attrIndex, { value: e.target.value })}
                          placeholder="e.g. Large"
                          className="h-9 flex-1 rounded border border-border bg-background px-2.5 text-sm text-text-primary outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => removeAttribute(variant.uid, attrIndex)}
                          className="text-xs font-medium text-danger"
                          aria-label="Remove attribute"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <details className="rounded-lg border border-border bg-background p-6">
        <summary className="cursor-pointer font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
          SEO (optional)
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          <FormField
            label="SEO title"
            id="seoTitle"
            value={form.seoTitle ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, seoTitle: e.target.value }))}
          />
          <Textarea
            label="SEO description"
            id="seoDescription"
            rows={3}
            value={form.seoDescription ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, seoDescription: e.target.value }))}
          />
        </div>
      </details>

      {mode === 'edit' && currentProduct ? (
        <section className="rounded-lg border border-border bg-background p-6">
          <h2 className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">Images</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {currentProduct.images.map((image) => (
              <div key={image.id} className="group relative h-24 w-24 overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveImageUrl(image.url)}
                  alt={image.altText ?? currentProduct.name}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleImageDelete(image.id)}
                  disabled={deletingImageId === image.id}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground opacity-0 transition group-hover:opacity-100 disabled:opacity-60"
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
            ))}
            <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-muted-border text-2xs text-text-secondary hover:border-primary">
              {uploadingImage ? 'Uploading…' : '+ Upload'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
            </label>
          </div>
          {imageError ? <p className="mt-2 text-xs text-danger">{imageError}</p> : null}
        </section>
      ) : null}

      {formError ? <p className="text-sm text-danger">{formError}</p> : null}
      {formSuccess ? <p className="text-sm text-success">{formSuccess}</p> : null}

      <div className="flex items-center justify-between">
        <div>
          {mode === 'edit' && currentProduct ? (
            <Button type="button" variant="danger" onClick={handleDeleteProduct} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete product'}
            </Button>
          ) : null}
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create product'}
        </Button>
      </div>
    </form>
  );
}
