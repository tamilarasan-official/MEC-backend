/**
 * Image Proxy Validation
 * Prevents path traversal attacks by validating folder and filename parameters
 */

import { z } from 'zod';

// Whitelist of allowed folders in S3 bucket
// Must match StorageFolders in storage.util.ts + any legacy folders with existing data
const ALLOWED_FOLDERS = [
  // Current StorageFolders (storage.util.ts)
  'menu',
  'categories',
  'shops',
  'users',
  'avatars',
  'offers',
  // Legacy folder names (may have existing data in S3)
  'meccanteen',
  'menuimages',
  'shop-images',
  'user-avatars',
  'category-images',
  'banner-images',
] as const;

// Allowed image extensions
const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'] as const;

/**
 * Validates that a string doesn't contain path traversal characters
 */
function isCleanPath(value: string): boolean {
  // Check for path traversal patterns
  const dangerousPatterns = [
    '..',           // Parent directory traversal
    './',           // Current directory reference
    '\\',           // Windows path separator
    '%2e',          // URL encoded dot
    '%2f',          // URL encoded slash
    '%5c',          // URL encoded backslash
    '\0',           // Null byte
    '\n',           // Newline
    '\r',           // Carriage return
  ];

  const lowerValue = value.toLowerCase();
  return !dangerousPatterns.some(pattern => lowerValue.includes(pattern));
}

/**
 * Schema for image proxy parameters
 */
export const imageProxyParamsSchema = z.object({
  folder: z.string()
    .min(1, 'Folder name is required')
    .max(50, 'Folder name too long')
    .refine(
      (val) => ALLOWED_FOLDERS.includes(val as typeof ALLOWED_FOLDERS[number]),
      { message: 'Invalid folder name' }
    )
    .refine(
      (val) => isCleanPath(val),
      { message: 'Invalid characters in folder name' }
    ),
  filename: z.string()
    .min(1, 'Filename is required')
    .max(255, 'Filename too long')
    .refine(
      (val) => isCleanPath(val),
      { message: 'Invalid characters in filename' }
    )
    .refine(
      (val) => {
        // Extract extension and validate
        const parts = val.split('.');
        if (parts.length < 2) return false;
        const ext = parts[parts.length - 1].toLowerCase();
        return ALLOWED_EXTENSIONS.includes(ext as typeof ALLOWED_EXTENSIONS[number]);
      },
      { message: 'Invalid file extension. Allowed: png, jpg, jpeg, gif, webp' }
    )
    .refine(
      (val) => {
        // Validate filename format: alphanumeric, spaces, dashes, underscores, dots, parentheses
        // Spaces are common in filenames stored in S3 (URL-decoded by Express before validation)
        return /^[\w\-. ()]+$/i.test(val);
      },
      { message: 'Filename contains invalid characters' }
    ),
});

export type ImageProxyParams = z.infer<typeof imageProxyParamsSchema>;

/**
 * Validate image proxy parameters
 */
export function validateImageProxyParams(params: unknown): {
  success: true;
  data: ImageProxyParams;
} | {
  success: false;
  errors: z.ZodIssue[];
} {
  const result = imageProxyParamsSchema.safeParse(params);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

export default {
  imageProxyParamsSchema,
  validateImageProxyParams,
  ALLOWED_FOLDERS,
  ALLOWED_EXTENSIONS,
};
