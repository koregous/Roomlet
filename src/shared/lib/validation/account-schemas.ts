import { z } from 'zod'

export const USERNAME_MIN = 3
export const USERNAME_MAX = 30
export const USERNAME_COOLDOWN_DAYS = 30
export const USERNAME_HOLD_DAYS = 90
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 72 // bcrypt only uses the first 72 bytes

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(USERNAME_MIN, `Username must be at least ${USERNAME_MIN} characters`)
  .max(USERNAME_MAX, `Username must be at most ${USERNAME_MAX} characters`)
  .regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers, and underscores allowed')

export const emailSchema = z.string().trim().toLowerCase().email('Please enter a valid email').max(254)

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX, `Password must be at most ${PASSWORD_MAX} characters`)

export const changeUsernameBody = z.object({
  username: usernameSchema,
  password: z.string().min(1, 'Enter your password to confirm'),
})

export const changeEmailBody = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password to confirm'),
})

export const changePasswordBody = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: newPasswordSchema,
})

export const deleteAccountBody = z.object({
  password: z.string().min(1, 'Enter your password to confirm'),
  confirmUsername: z.string().trim().toLowerCase().min(1, 'Type your username to confirm'),
})

export const loginBody = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(PASSWORD_MAX),
})

export type PasswordStrength = 'weak' | 'fair' | 'strong'

export function getPasswordStrength(pwd: string): PasswordStrength {
  if (pwd.length < PASSWORD_MIN) return 'weak'
  if (pwd.length < 12 || !/[A-Z]/.test(pwd) || !/[0-9]/.test(pwd)) return 'fair'
  return 'strong'
}
