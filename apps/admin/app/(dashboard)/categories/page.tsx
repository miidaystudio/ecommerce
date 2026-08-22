'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { Category } from '@ecommerce/shared-types';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { Select } from '../../../components/ui/Select';
import { ApiError } from '../../../lib/api/client';
import { catalogApi } from '../../../lib/api/catalog.api';
import { slugify } from '../../../lib/utils/slugify';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [parentId, setParentId] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadCategories() {
    setLoading(true);
    setLoadError('');
    try {
      const data = await catalogApi.listCategories();
      setCategories(data);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  function parentName(parentIdValue: string | null): string {
    if (!parentIdValue) return '—';
    return categories.find((c) => c.id === parentIdValue)?.name ?? '—';
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');

    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Name is required';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      await catalogApi.createCategory({
        name: name.trim(),
        slug: slug.trim() || undefined,
        parentId: parentId || undefined,
      });
      setName('');
      setSlug('');
      setSlugTouched(false);
      setParentId('');
      await loadCategories();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Failed to create category');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Categories</h1>
        <p className="mt-1.5 text-xs text-text-secondary">Organize your catalog into categories.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-lg border border-border bg-background">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-surface text-2xs uppercase tracking-[0.1em] text-text-secondary">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium">Parent</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-sm text-text-secondary">
                      Loading categories…
                    </td>
                  </tr>
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-sm text-text-secondary">
                      No categories yet.
                    </td>
                  </tr>
                ) : (
                  categories.map((category) => (
                    <tr key={category.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-sm font-medium text-text-primary">{category.name}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{category.slug}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{parentName(category.parentId)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {loadError ? <p className="mt-3 text-sm text-danger">{loadError}</p> : null}
        </div>

        <div className="rounded-lg border border-border bg-background p-6">
          <h2 className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">New category</h2>
          <form onSubmit={onSubmit} noValidate className="mt-4 flex flex-col gap-4">
            <FormField label="Name" value={name} onChange={(e) => handleNameChange(e.target.value)} error={fieldErrors.name} />
            <FormField
              label="Slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="auto-generated from name"
            />
            <Select label="Parent category" value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">No parent</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            {formError ? <p className="text-xs text-danger">{formError}</p> : null}
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create category'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
