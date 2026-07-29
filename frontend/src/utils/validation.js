// Shared validation schemas using Zod, inspired by the MSIL production codebase
import { z } from 'zod'

// ─── Auth ──────────────────────────────────────────────────────────
export const loginSchema = z.object({
  username: z
    .string()
    .min(1, 'Username is required')
    .min(3, 'Username must be at least 3 characters'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters')
})

// ─── Tags ───────────────────────────────────────────────────────────
export const tagStatusEnum = z.enum(['ACTIVE', 'TEMP_DISABLED', 'PERMANENT_DISABLED'])
export const alertStatusEnum = z.enum(['NONE', 'ALARMING', 'OVERDUE'])

export const createTagSchema = z.object({
  tagId: z
    .string()
    .min(1, 'Tag ID is required')
    .max(50, 'Tag ID must be 50 characters or less')
    .regex(/^[A-Za-z0-9_-]+$/, 'Tag ID may only contain letters, numbers, hyphens, and underscores'),
  equipment: z.string().min(1, 'Equipment is required'),
  assignedZone: z.string().nullable().optional(),
  status: tagStatusEnum.optional().default('ACTIVE')
})

export const updateTagSchema = z.object({
  status: tagStatusEnum.optional(),
  assignedZone: z.string().nullable().optional(),
  disabledUntil: z.string().nullable().optional(),
  disableReason: z.string().max(200, 'Reason must be 200 characters or less').optional()
})

// ─── Settings ───────────────────────────────────────────────────────
export const settingsSchema = z.object({
  alarmDurationSec: z
    .number()
    .int('Must be a whole number')
    .min(1, 'Must be at least 1 second')
    .max(300, 'Must be 300 seconds or less'),
  alarmRepeatIntervalSec: z
    .number()
    .int('Must be a whole number')
    .min(1, 'Must be at least 1 second')
    .max(3600, 'Must be 3600 seconds or less'),
  alarmVolume: z
    .number()
    .int('Must be a whole number')
    .min(0, 'Minimum volume is 0')
    .max(100, 'Maximum volume is 100'),
  alarmMuted: z.boolean().optional(),
  emailRepeatIntervalSec: z
    .number()
    .int('Must be a whole number')
    .min(60, 'Must be at least 60 seconds')
    .max(86400, 'Must be 86400 seconds or less'),
  overdueEmailRepeatIntervalSec: z
    .number()
    .int('Must be a whole number')
    .min(60, 'Must be at least 60 seconds')
    .max(604800, 'Must be 604800 seconds or less')
})

// ─── Recipients ─────────────────────────────────────────────────────
export const recipientRoles = ['ADMIN', 'SUPPORT', 'SECURITY']

export const createRecipientSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  role: z.enum(recipientRoles)
})

// ─── Users ──────────────────────────────────────────────────────────
export const userRoles = ['ADMIN', 'USER', 'ZONE_MANAGER', 'AUDITOR', 'OPERATOR', 'INTEGRATION']

export const createUserSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be 30 characters or less')
    .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, 'Username must start with a letter'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password must contain a special character'),
  role: z.enum(userRoles).optional().default('USER'),
  zones: z.array(z.string()).optional().default([])
})

// ─── Devices / Readers ──────────────────────────────────────────────
export const deviceDirections = ['ENTRY', 'EXIT', '']
export const deviceStatuses = ['ONLINE', 'OFFLINE', 'UNKNOWN']

export const createDeviceSchema = z.object({
  readerId: z.string().min(1, 'Reader ID is required'),
  name: z.string().min(1, 'Display name is required'),
  zone: z.string().nullable().optional(),
  antennaPort: z.number().int().positive('Port must be a positive number').nullable().optional(),
  direction: z.enum(deviceDirections).optional(),
  status: z.enum(deviceStatuses).optional().default('ONLINE'),
  description: z.string().max(500).optional()
})

// ─── Equipment ──────────────────────────────────────────────────────
export const createEquipmentSchema = z.object({
  name: z.string().min(1, 'Equipment name is required'),
  category: z.string().min(1, 'Category is required'),
  quantity: z.number().int('Quantity must be a whole number').positive('Quantity must be positive').optional().default(1)
})

// ─── Zones ──────────────────────────────────────────────────────────
export const createZoneSchema = z.object({
  name: z.string().min(1, 'Zone name is required'),
  description: z.string().max(500).optional()
})

// ─── Helper: validate with friendly errors ──────────────────────────
export function validateWithErrors(schema, data) {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data, errors: null }
  }
  const fieldErrors = {}
  for (const issue of result.error.issues) {
    const path = issue.path.join('.')
    if (!fieldErrors[path]) {
      fieldErrors[path] = issue.message
    }
  }
  return { success: false, data: null, errors: fieldErrors }
}

export default {
  loginSchema,
  createTagSchema,
  updateTagSchema,
  settingsSchema,
  createRecipientSchema,
  createUserSchema,
  createDeviceSchema,
  createEquipmentSchema,
  createZoneSchema,
  validateWithErrors
}
