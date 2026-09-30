import { z } from 'zod';

export const EVENT_STATUSES = [
  'planning',
  'active',
  'completed',
  'cancelled',
] as const;

const MAX_AMOUNT = 1_000_000_000_000_000;
const MAX_MEMBERS_PER_REQUEST = 50;

const nameSchema = z
  .string({ error: 'Nama acara wajib diisi' })
  .trim()
  .min(1, 'Nama acara wajib diisi')
  .max(255, 'Nama acara maksimal 255 karakter');

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} maksimal ${max} karakter`)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

// Terima tanggal saja (YYYY-MM-DD, dianggap 00:00 UTC) atau datetime ISO.
const dateSchema = (label: string) =>
  z
    .union([z.iso.date(), z.iso.datetime({ offset: true })], {
      error: `${label} harus berformat YYYY-MM-DD atau datetime ISO 8601`,
    })
    .transform((value) => new Date(value))
    .nullable()
    .optional();

const budgetSchema = z
  .number({ error: 'Anggaran harus berupa angka' })
  .nonnegative('Anggaran tidak boleh negatif')
  .lt(MAX_AMOUNT, 'Anggaran terlalu besar')
  .nullable()
  .optional();

const endAfterStart = (data: {
  start_date?: Date | null;
  end_date?: Date | null;
}) =>
  !data.start_date ||
  !data.end_date ||
  data.end_date.getTime() >= data.start_date.getTime();

const endAfterStartIssue = {
  message: 'Tanggal selesai tidak boleh sebelum tanggal mulai',
  path: ['end_date'],
};

export const createEventSchema = z
  .object({
    name: nameSchema,
    description: optionalText(1000, 'Deskripsi'),
    location: optionalText(255, 'Lokasi'),
    start_date: dateSchema('Tanggal mulai'),
    end_date: dateSchema('Tanggal selesai'),
    // Acara baru hanya bisa direncanakan atau langsung berjalan.
    status: z
      .enum(['planning', 'active'], {
        error: 'Status awal acara harus planning atau active',
      })
      .default('planning'),
    budget: budgetSchema,
  })
  .refine(endAfterStart, endAfterStartIssue);

export const updateEventSchema = z
  .object({
    name: nameSchema.optional(),
    description: optionalText(1000, 'Deskripsi'),
    location: optionalText(255, 'Lokasi'),
    start_date: dateSchema('Tanggal mulai'),
    end_date: dateSchema('Tanggal selesai'),
    status: z
      .enum(EVENT_STATUSES, { error: 'Status acara tidak valid' })
      .optional(),
    budget: budgetSchema,
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: 'Tidak ada data yang diubah' },
  )
  .refine(endAfterStart, endAfterStartIssue);

export const addEventMembersSchema = z.object({
  user_ids: z
    .array(z.uuid('ID pengguna tidak valid'), {
      error: 'user_ids harus berupa daftar ID pengguna',
    })
    .min(1, 'Pilih minimal 1 anggota')
    .max(
      MAX_MEMBERS_PER_REQUEST,
      `Maksimal ${MAX_MEMBERS_PER_REQUEST} anggota per permintaan`,
    )
    .transform((ids) => [...new Set(ids)]),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type AddEventMembersInput = z.infer<typeof addEventMembersSchema>;
