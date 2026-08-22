import { z } from 'zod';

// The product form keeps all numeric fields as strings while the user is
// typing (controlled inputs), so these helpers validate the string and then
// transform it into the number the API actually expects.

function requiredNonNegativeNumber(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => !Number.isNaN(Number(v)), `${label} must be a number`)
    .refine((v) => Number(v) >= 0, `${label} must be 0 or more`)
    .transform((v) => Number(v));
}

function requiredNonNegativeInt(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => Number.isInteger(Number(v)), `${label} must be a whole number`)
    .refine((v) => Number(v) >= 0, `${label} must be 0 or more`)
    .transform((v) => Number(v));
}

const optionalNonNegativeNumber = z
  .string()
  .optional()
  .transform((v) => (v ?? '').trim())
  .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0), 'Must be 0 or more')
  .transform((v) => (v === '' ? undefined : Number(v)));

const attributeRowSchema = z.object({
  key: z.string().trim(),
  value: z.string().trim(),
});

export const variantFormSchema = z.object({
  uid: z.string(),
  id: z.string().optional(),
  sku: z.string().trim().min(1, 'SKU is required'),
  name: z.string().trim().min(1, 'Variant name is required'),
  attributes: z.array(attributeRowSchema),
  price: requiredNonNegativeNumber('Price'),
  compareAtPrice: optionalNonNegativeNumber,
  stock: requiredNonNegativeInt('Stock'),
  isDefault: z.boolean(),
});

export const productFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    slug: z.string().trim().optional(),
    description: z.string().trim().min(1, 'Description is required'),
    status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
    categoryId: z.string().min(1, 'Select a category').uuid('Select a category'),
    brandId: z.string().trim().optional(),
    seoTitle: z.string().trim().optional(),
    seoDescription: z.string().trim().optional(),
    variants: z.array(variantFormSchema).min(1, 'Add at least one variant'),
  })
  .refine((data) => data.variants.filter((v) => v.isDefault).length === 1, {
    message: 'Exactly one variant must be marked as default',
    path: ['variants'],
  });

// Input type (pre-transform): what the form's React state looks like —
// numeric fields are still strings here, matching controlled <input> values.
export type ProductFormInput = z.input<typeof productFormSchema>;
export type VariantFormInput = z.input<typeof variantFormSchema>;

// Output type (post-transform): what gets mapped into the API payload.
export type ProductFormOutput = z.output<typeof productFormSchema>;
export type VariantFormOutput = z.output<typeof variantFormSchema>;
