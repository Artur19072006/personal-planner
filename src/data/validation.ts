import { z } from 'zod';
import { format, isValid, parseISO } from 'date-fns';
import { COLORS, ICONS } from './models';

export const titleSchema = z.string().trim().min(1, 'Укажите название').max(250, 'Не больше 250 символов');
export const dateSchema = z.string().refine(value => /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value)) && format(parseISO(value), 'yyyy-MM-dd') === value, 'Укажите корректную дату');
const stamp = z.string().datetime({ offset: true });
const id = z.string().min(1).max(100);
const base = { id, createdAt: stamp, updatedAt: stamp };
const order = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const categorySchema = z.object({ ...base, name: titleSchema, icon: z.enum(ICONS), color: z.enum(COLORS), order }).strict();
export const entrySchema = z.object({
  ...base, type: z.enum(['task', 'project', 'routine']), title: titleSchema,
  description: z.string().max(10000), categoryId: id.nullable(), parentId: id.nullable(),
  dueDate: dateSchema.nullable(), completedAt: stamp.nullable(), order,
}).strict();
export const stepSchema = z.object({ ...base, projectId: id, title: titleSchema, completedAt: stamp.nullable(), order }).strict();
export const sessionSchema = z.object({ ...base, routineId: id, date: dateSchema, minutes: z.number().int().positive().max(1440).nullable() }).strict();
export const settingsSchema = z.object({ id: z.literal('preferences'), theme: z.enum(['system', 'light', 'dark']) }).strict();
const backupSchema = z.object({
  app: z.literal('personal-planner'), schemaVersion: z.literal(1), exportedAt: stamp,
  categories: z.array(categorySchema).max(10000), entries: z.array(entrySchema).max(100000),
  steps: z.array(stepSchema).max(100000), sessions: z.array(sessionSchema).max(100000), settings: z.array(settingsSchema).max(1),
}).strict().superRefine((data, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  const ids = new Set<string>();
  for (const row of [...data.categories, ...data.entries, ...data.steps, ...data.sessions]) {
    if (ids.has(row.id)) fail('Повторяющийся ID');
    ids.add(row.id);
    if (Date.parse(row.updatedAt) < Date.parse(row.createdAt)) fail('Дата изменения раньше даты создания');
  }
  const categories = new Set(data.categories.map(c => c.id));
  const entries = new Map(data.entries.map(e => [e.id, e]));
  for (const entry of data.entries) {
    if (entry.categoryId !== null && !categories.has(entry.categoryId)) fail('Категория записи не найдена');
    if (entry.type !== 'task' && (entry.categoryId === null || entry.parentId !== null)) fail('Некорректное расположение проекта или направления');
    if (entry.type === 'routine' && (entry.completedAt !== null || entry.dueDate !== null)) fail('Направление не имеет завершения или срока');
    if (entry.parentId !== null) {
      const parent = entries.get(entry.parentId);
      if (entry.type !== 'task' || parent?.type !== 'routine' || parent.categoryId !== entry.categoryId) fail('Некорректная связь задачи с направлением');
    }
  }
  for (const step of data.steps) if (entries.get(step.projectId)?.type !== 'project') fail('Проект шага не найден');
  for (const session of data.sessions) if (entries.get(session.routineId)?.type !== 'routine') fail('Направление занятия не найдено');
});

export function parseBackup(value: unknown) {
  if (typeof value !== 'object' || value === null || !('app' in value) || value.app !== 'personal-planner') throw new Error('Это не резервная копия Personal Planner');
  if (!('schemaVersion' in value) || value.schemaVersion !== 1) throw new Error('Версия резервной копии не поддерживается');
  return backupSchema.parse(value);
}
export function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? 'Проверьте данные';
  if (error instanceof Error) {
    if (error.name === 'QuotaExceededError') return 'Недостаточно места. Сохраните резервную копию и освободите память устройства.';
    return error.message;
  }
  return 'Не удалось сохранить данные. Повторите попытку.';
}
