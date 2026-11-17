/**
 * Zod validation schemas for featured rotation configuration
 * 
 * Provides type-safe validation for rotation modes, configurations,
 * and admin operations on featured content.
 */

import { z } from 'zod';

// Rotation mode enum
export const RotationModeSchema = z.enum(['time-based', 'manual', 'hybrid'], {
  errorMap: () => ({ message: 'Mode must be one of: time-based, manual, hybrid' }),
});

// Time-based rotation configuration
export const TimeBasedConfigSchema = z.object({
  expiryHours: z
    .number()
    .positive({ message: 'Expiry hours must be greater than 0' })
    .int({ message: 'Expiry hours must be an integer' })
    .min(1, { message: 'Expiry hours must be at least 1' })
    .max(8760, { message: 'Expiry hours cannot exceed 1 year (8760 hours)' }),
  fallbackToHighViews: z
    .boolean()
    .default(true)
    .describe('Whether to fallback to high-view sections when featured pool is empty'),
});

// Hybrid scoring configuration
export const HybridConfigSchema = z
  .object({
    viewCountWeight: z
      .number()
      .nonnegative({ message: 'View count weight must be non-negative' })
      .max(1.0, { message: 'View count weight cannot exceed 1.0' })
      .default(0.4),
    recencyWeight: z
      .number()
      .nonnegative({ message: 'Recency weight must be non-negative' })
      .max(1.0, { message: 'Recency weight cannot exceed 1.0' })
      .default(0.3),
    engagementWeight: z
      .number()
      .nonnegative({ message: 'Engagement weight must be non-negative' })
      .max(1.0, { message: 'Engagement weight cannot exceed 1.0' })
      .default(0.2),
    manualBoostMultiplier: z
      .number()
      .min(1.0, { message: 'Manual boost multiplier must be at least 1.0' })
      .max(10.0, { message: 'Manual boost multiplier cannot exceed 10.0' })
      .default(1.5),
  })
  .refine(
    (data) => {
      const sum = data.viewCountWeight + data.recencyWeight + data.engagementWeight;
      return sum <= 1.0;
    },
    {
      message: 'Sum of weights (viewCount + recency + engagement) must not exceed 1.0',
      path: ['weights'],
    }
  );

// Discriminated union for rotation configuration
export const RotationConfigSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('time-based'),
    timeBasedConfig: TimeBasedConfigSchema,
  }),
  z.object({
    mode: z.literal('manual'),
  }),
  z.object({
    mode: z.literal('hybrid'),
    hybridConfig: HybridConfigSchema,
  }),
]);

// Featured options for queries
export const FeaturedOptionsSchema = z.object({
  limit: z
    .number()
    .int()
    .positive()
    .max(100, { message: 'Limit cannot exceed 100' })
    .optional()
    .default(10),
  excludeIds: z
    .array(z.string().uuid({ message: 'Invalid section ID format' }))
    .optional()
    .default([]),
});

// Admin operations schemas

export const AddToFeaturedSchema = z.object({
  sectionId: z.string().uuid({ message: 'Invalid section ID format' }),
  priority: z
    .number()
    .int()
    .nonnegative({ message: 'Priority must be non-negative' })
    .optional(),
  mode: RotationModeSchema.optional(),
});

export const RemoveFromFeaturedSchema = z.object({
  sectionId: z.string().uuid({ message: 'Invalid section ID format' }),
});

export const ReorderFeaturedSchema = z.object({
  sectionIds: z
    .array(z.string().uuid({ message: 'Invalid section ID format' }))
    .min(1, { message: 'Must provide at least one section ID' })
    .max(100, { message: 'Cannot reorder more than 100 sections at once' }),
});

export const ApplyManualBoostSchema = z.object({
  sectionId: z.string().uuid({ message: 'Invalid section ID format' }),
  boostMultiplier: z
    .number()
    .min(1.0, { message: 'Boost multiplier must be at least 1.0' })
    .max(10.0, { message: 'Boost multiplier cannot exceed 10.0' }),
});

export const MarkAsFeaturedSchema = z.object({
  sectionId: z.string().uuid({ message: 'Invalid section ID format' }),
  expiryHours: z
    .number()
    .positive()
    .int()
    .min(1)
    .max(8760, { message: 'Expiry hours cannot exceed 1 year' }),
  userId: z.string().uuid({ message: 'Invalid user ID format' }),
});

// Type exports for use in application code
export type RotationMode = z.infer<typeof RotationModeSchema>;
export type TimeBasedConfig = z.infer<typeof TimeBasedConfigSchema>;
export type HybridConfig = z.infer<typeof HybridConfigSchema>;
export type RotationConfig = z.infer<typeof RotationConfigSchema>;
export type FeaturedOptions = z.infer<typeof FeaturedOptionsSchema>;
export type AddToFeaturedInput = z.infer<typeof AddToFeaturedSchema>;
export type RemoveFromFeaturedInput = z.infer<typeof RemoveFromFeaturedSchema>;
export type ReorderFeaturedInput = z.infer<typeof ReorderFeaturedSchema>;
export type ApplyManualBoostInput = z.infer<typeof ApplyManualBoostSchema>;
export type MarkAsFeaturedInput = z.infer<typeof MarkAsFeaturedSchema>;
