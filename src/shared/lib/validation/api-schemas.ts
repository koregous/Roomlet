/**
 * API Input Validation Schemas
 * 
 * Centralized Zod schemas for validating API request bodies.
 * Prevents injection attacks, type confusion, and malformed data.
 */

import { z } from 'zod'

export const uuidSchema = z.string().uuid('Invalid UUID format')

export const AddFeaturedSchema = z.object({
  sectionId: uuidSchema,
  categoryId: uuidSchema.optional(),
  priority: z.number().int().min(0).max(100).optional(),
  expiryHours: z.number().positive().max(8760).optional(), // Max 1 year
})

export type AddFeaturedInput = z.infer<typeof AddFeaturedSchema>

export const CreateReportSchema = z.object({
  section_id: uuidSchema,
  reason: z.enum(['spam', 'harassment', 'adult_content', 'violence', 'copyright']),
})

export type CreateReportInput = z.infer<typeof CreateReportSchema>

// Block validation (basic structure)
const BlockSchema = z.object({
  id: uuidSchema,
  type: z.enum(['text', 'image', 'gallery', 'carousel', 'quote', 'divider', 'links', 'audio']),
  content: z.record(z.any()), // Content is flexible per block type
  order: z.number().int().min(0),
})

export const CreateSectionSchema = z.object({
  title: z.string().min(1, 'Title required').max(200, 'Title too long'),
  blocks: z.array(BlockSchema).min(1, 'At least one block required').max(50, 'Too many blocks'),
  category_id: uuidSchema,
  published: z.boolean(),
  is_nsfw: z.boolean().optional().default(false),
})

export const UpdateSectionSchema = CreateSectionSchema.partial()

export type CreateSectionInput = z.infer<typeof CreateSectionSchema>
export type UpdateSectionInput = z.infer<typeof UpdateSectionSchema>

export const UpdateProfileSchema = z.object({
  display_name: z.string()
    .min(1, 'Display name required')
    .max(50, 'Display name too long')
    .optional(),
  bio: z.string()
    .max(500, 'Bio too long')
    .optional(),
  username: z.string()
    .min(3, 'Username too short')
    .max(30, 'Username too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')
    .optional(),
})

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>

export const CreateTagSchema = z.object({
  name: z.string()
    .min(1, 'Tag name required')
    .max(50, 'Tag name too long')
    .regex(/^[a-zA-Z0-9\s-]+$/, 'Invalid tag format'),
})

export type CreateTagInput = z.infer<typeof CreateTagSchema>

export const PaginationSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
})

export type PaginationInput = z.infer<typeof PaginationSchema>

export const UploadMetadataSchema = z.object({
  filename: z.string().max(255),
  contentType: z.string().regex(/^(image|audio|video)\/[a-z0-9+.-]+$/i, 'Invalid content type'),
  size: z.number().int().min(1).max(10 * 1024 * 1024), // Max 10MB
})

export type UploadMetadataInput = z.infer<typeof UploadMetadataSchema>

/**
 * Validates request body against schema and returns typed data or error response
 * 
 * @example
 * const result = validateRequest(AddFeaturedSchema, body)
 * if (!result.success) {
 *   return NextResponse.json(result.error, { status: 400 })
 * }
 * const data = result.data // Typed!
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): 
  | { success: true; data: T }
  | { success: false; error: { error: string; details: any[] } }
{
  const validation = schema.safeParse(data)
  
  if (!validation.success) {
    return {
      success: false,
      error: {
        error: 'Invalid input',
        details: validation.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      },
    }
  }
  
  return {
    success: true,
    data: validation.data,
  }
}

/**
 * Sanitizes string input by removing potentially dangerous characters
 * Use this for user-facing text fields that will be displayed (not stored raw)
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/[<>]/g, '') // Remove angle brackets (XSS prevention)
    .replace(/\0/g, '') // Remove null bytes
    .trim()
}

/**
 * Validates and sanitizes username
 * Enforces alphanumeric + underscore/hyphen only
 */
export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' }
  }
  
  if (username.length > 30) {
    return { valid: false, error: 'Username must be at most 30 characters' }
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' }
  }
  
  return { valid: true }
}

export function isValidUUID(uuid: string): boolean {
  return uuidSchema.safeParse(uuid).success
}
