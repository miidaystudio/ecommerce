import { z } from 'zod';

// Mirrors UpsertReviewDto on the API.
export const reviewFormSchema = z.object({
  rating: z
    .number()
    .int('Choose a star rating')
    .min(1, 'Choose a star rating')
    .max(5, 'Choose a star rating'),
  title: z
    .string()
    .trim()
    .max(120, 'Keep the headline under 120 characters')
    .optional()
    .transform((v) => (v ? v : undefined)),
  body: z
    .string()
    .trim()
    .min(1, 'Write a few words about the product')
    .max(2000, 'Keep your review under 2000 characters'),
});

export type ReviewFormInput = z.input<typeof reviewFormSchema>;
export type ReviewFormOutput = z.output<typeof reviewFormSchema>;
