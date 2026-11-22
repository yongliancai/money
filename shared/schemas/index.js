import { z } from 'zod';

export const backendConfigSchema = z
  .object({
    aiMode: z.enum(['disabled', 'demo', 'live']),
    pushReady: z.boolean(),
    pushPublicKey: z.string().max(200),
    reminderPolicyPending: z.boolean(),
  })
  .strict();

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T12:00:00Z`);
    return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === s;
  }, '日期不存在');
export const zoneSchema = z
  .string()
  .max(100)
  .refine((s) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: s });
      return true;
    } catch {
      return false;
    }
  }, '無效時區');
export const draftSchema = z
  .object({
    item: z.string().trim().min(1).max(100),
    amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    category: z.string().trim().min(1).max(40),
    expenseDate: dateSchema,
  })
  .strict();
export const expenseSchema = draftSchema
  .extend({
    id: z.uuid(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    origin: z.enum(['manual', 'ai_confirmed', 'import']),
    schemaVersion: z.literal(1),
  })
  .strict();
export const backupSchema = z
  .object({
    schemaVersion: z.literal(1),
    exportedAt: z.iso.datetime(),
    expenses: z.array(expenseSchema).max(20000),
  })
  .strict();
export const aiResultSchema = z
  .object({
    drafts: z.array(draftSchema).max(50),
    unparsed: z.array(z.string().max(2000)).max(50),
  })
  .strict()
  .refine((x) => x.drafts.length > 0 || x.unparsed.length > 0, '無解析結果');
export const parseRequestSchema = z
  .object({
    text: z.string().trim().min(1).max(4000),
    referenceDate: dateSchema,
  })
  .strict();
export const settingsSchema = z
  .object({
    enabled: z.boolean(),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    timeZone: zoneSchema,
    revision: z.number().int().positive().safe(),
  })
  .strict();
export const eventSchema = z
  .object({
    eventId: z.uuid(),
    localDate: dateSchema,
    timeZone: zoneSchema,
    revision: z.number().int().positive().safe(),
    completed: z.boolean(),
    occurredAt: z.iso.datetime(),
    settingsRevision: z.number().int().positive().safe(),
  })
  .strict();
export const subscriptionSchema = z
  .object({
    endpoint: z.url().max(2048),
    expirationTime: z.number().nullable().optional(),
    keys: z
      .object({
        p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}={0,1}$/),
        auth: z.string().regex(/^[A-Za-z0-9_-]{22}={0,2}$/),
      })
      .strict(),
  })
  .strict();
