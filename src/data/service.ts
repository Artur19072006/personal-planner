import { format } from 'date-fns';
import { db, type PlannerDB } from './db';
import type { Backup, Category, Entry, Session, Snapshot } from './models';
import { categorySchema, entrySchema, parseBackup, sessionSchema, stepSchema, titleSchema } from './validation';

const stamp = () => new Date().toISOString();
function createId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const base = () => { const now = stamp(); return { id: createId(), createdAt: now, updatedAt: now }; };
export class PlannerService {
  constructor(public database: PlannerDB = db) {}
  async saveCategory(input: Pick<Category, 'name' | 'icon' | 'color'>, id?: string) {
    return this.database.transaction('rw', this.database.categories, async () => {
      const existing = id ? await this.database.categories.get(id) : undefined;
      if (id && !existing) throw new Error('Категория не найдена');
      const category = categorySchema.parse({ ...base(), order: ((await this.database.categories.orderBy('order').last())?.order ?? -1) + 1, ...existing, ...input, updatedAt: stamp() });
      await this.database.categories.put(category);
      return category;
    });
  }
  async deleteCategory(id: string, targetId?: string) {
    const d = this.database;
    await d.transaction('rw', d.categories, d.entries, async () => {
      const content = await d.entries.where('categoryId').equals(id).toArray();
      if (content.length) {
        if (!targetId || targetId === id || !await d.categories.get(targetId)) throw new Error('Сначала выберите категорию для переноса записей');
        await d.entries.where('categoryId').equals(id).modify({ categoryId: targetId, updatedAt: stamp() });
      }
      await d.categories.delete(id);
    });
  }
  async saveEntry(input: Pick<Entry, 'type' | 'title' | 'description' | 'categoryId' | 'parentId' | 'dueDate'>, id?: string) {
    const d = this.database;
    return d.transaction('rw', d.entries, d.categories, async () => {
      const existing = id ? await d.entries.get(id) : undefined;
      if (id && !existing) throw new Error('Запись не найдена');
      if (existing && existing.type !== input.type) throw new Error('Тип существующей записи нельзя изменить');
      if (input.categoryId && !await d.categories.get(input.categoryId)) throw new Error('Категория не найдена');
      if (input.type !== 'task' && (!input.categoryId || input.parentId)) throw new Error('Выберите категорию');
      if (input.parentId) {
        const parent = await d.entries.get(input.parentId);
        if (input.type !== 'task' || parent?.type !== 'routine' || parent.categoryId !== input.categoryId) throw new Error('Неверное направление задачи');
      }
      const entry = entrySchema.parse({ ...base(), completedAt: null, order: ((await d.entries.orderBy('order').last())?.order ?? -1) + 1, ...existing, ...input, dueDate: input.type === 'routine' ? null : input.dueDate, updatedAt: stamp() });
      await d.entries.put(entry);
      if (entry.type === 'routine') await d.entries.where('parentId').equals(entry.id).modify({ categoryId: entry.categoryId, updatedAt: stamp() });
      return entry;
    });
  }
  async quickTask(title: string, categoryId: string | null = null, parentId: string | null = null) {
    return this.saveEntry({ type: 'task', title, description: '', categoryId, parentId, dueDate: null });
  }
  async toggleEntry(id: string, allowUnfinished = false) {
    const d = this.database;
    await d.transaction('rw', d.entries, d.steps, async () => {
      const entry = await d.entries.get(id);
      if (!entry || entry.type === 'routine') throw new Error('Запись не найдена');
      if (entry.type === 'project' && !entry.completedAt && !allowUnfinished && (await d.steps.where('projectId').equals(id).toArray()).some(s => !s.completedAt)) throw new Error('В проекте остались невыполненные шаги');
      await d.entries.update(id, { completedAt: entry.completedAt ? null : stamp(), updatedAt: stamp() });
    });
  }
  async deleteEntry(id: string) {
    const d = this.database;
    await d.transaction('rw', d.entries, d.steps, d.sessions, async () => {
      await d.steps.where('projectId').equals(id).delete();
      await d.sessions.where('routineId').equals(id).delete();
      await d.entries.where('parentId').equals(id).delete();
      await d.entries.delete(id);
    });
  }
  async saveStep(projectId: string, title: string, id?: string, insertAt?: number) {
    const d = this.database;
    return d.transaction('rw', d.entries, d.steps, async () => {
      if ((await d.entries.get(projectId))?.type !== 'project') throw new Error('Проект не найден');
      const existing = id ? await d.steps.get(id) : undefined;
      if (id && (!existing || existing.projectId !== projectId)) throw new Error('Шаг не найден');
      const steps = (await d.steps.where('projectId').equals(projectId).sortBy('order'));
      const step = stepSchema.parse({ ...base(), projectId, completedAt: null, order: steps.length, ...existing, title: titleSchema.parse(title), updatedAt: stamp() });
      if (!existing) {
        const index = insertAt === undefined ? steps.length : Math.max(0, Math.min(insertAt, steps.length));
        steps.splice(index, 0, step);
        await d.steps.bulkPut(steps.map((row, order) => ({ ...row, order, updatedAt: stamp() })));
      } else await d.steps.put(step);
      return step;
    });
  }
  async toggleStep(id: string) {
    const d = this.database;
    await d.transaction('rw', d.steps, async () => {
      const step = await d.steps.get(id);
      if (!step) throw new Error('Шаг не найден');
      await d.steps.update(id, { completedAt: step.completedAt ? null : stamp(), updatedAt: stamp() });
    });
  }
  async deleteStep(id: string) { await this.database.steps.delete(id); }
  async reorder(table: 'steps' | 'categories', ids: string[]) {
    const target = this.database[table];
    await this.database.transaction('rw', target, async () => {
      if (new Set(ids).size !== ids.length || await target.bulkGet(ids).then(rows => rows.some(row => !row))) throw new Error('Список изменился. Повторите перемещение.');
      for (let order = 0; order < ids.length; order++) await target.update(ids[order], { order, updatedAt: stamp() });
    });
  }
  async saveSession(input: Pick<Session, 'routineId' | 'date' | 'minutes'>, id?: string) {
    const d = this.database;
    return d.transaction('rw', d.entries, d.sessions, async () => {
      if ((await d.entries.get(input.routineId))?.type !== 'routine') throw new Error('Направление не найдено');
      const existing = id ? await d.sessions.get(id) : undefined;
      if (id && (!existing || existing.routineId !== input.routineId)) throw new Error('Занятие не найдено');
      const session = sessionSchema.parse({ ...base(), ...existing, ...input, updatedAt: stamp() });
      if (session.date > format(new Date(), 'yyyy-MM-dd')) throw new Error('Занятие можно отметить за сегодня или прошедший день');
      await d.sessions.put(session);
      return session;
    });
  }
  async deleteSession(id: string) { await this.database.sessions.delete(id); }
  async setTheme(theme: 'system' | 'light' | 'dark') { await this.database.settings.put({ id: 'preferences', theme }); }
  async exportBackup(): Promise<Backup> {
    return { app: 'personal-planner', schemaVersion: 1, exportedAt: stamp(), ...await this.database.snapshot() };
  }
  async importBackup(value: unknown) {
    const data = parseBackup(value);
    const d = this.database;
    await d.transaction('rw', d.tables, async () => {
      for (const table of d.tables) await table.clear();
      await d.categories.bulkAdd(data.categories);
      await d.entries.bulkAdd(data.entries);
      await d.steps.bulkAdd(data.steps);
      await d.sessions.bulkAdd(data.sessions);
      await d.settings.bulkAdd(data.settings);
    });
  }
  async clear() {
    await this.database.transaction('rw', this.database.tables, async () => {
      for (const table of this.database.tables) await table.clear();
    });
  }
  async demo() {
    const d = this.database;
    await d.transaction('rw', d.tables, async () => {
      if (await d.entries.count() || await d.categories.count()) throw new Error('Демонстрационные данные доступны только в пустой базе');
      const study = await this.saveCategory({ name: 'Учёба', icon: 'book', color: 'sage' });
      await this.saveCategory({ name: 'Спорт', icon: 'dumbbell', color: 'peach' });
      await this.saveCategory({ name: 'Проекты', icon: 'folder', color: 'lavender' });
      const personal = await this.saveCategory({ name: 'Личное', icon: 'heart', color: 'blue' });
      for (const title of ['Математика', 'Этика']) await this.saveEntry({ type: 'routine', title, description: '', categoryId: study.id, parentId: null, dueDate: null });
      const project = await this.saveEntry({ type: 'project', title: 'Получить водительские права', description: 'От выбора автошколы до первого самостоятельного маршрута.', categoryId: personal.id, parentId: null, dueDate: null });
      for (const title of ['Найти автошколу', 'Сравнить предложения', 'Позвонить и записаться', 'Пройти теорию', 'Сдать экзамен']) await this.saveStep(project.id, title);
      await this.quickTask('Написать дерматологу');
      await this.quickTask('Забрать посылку');
      await this.quickTask('Купить тетради');
    });
  }
}
export const planner = new PlannerService();
export function snapshotIsEmpty(data: Snapshot) { return !data.categories.length && !data.entries.length; }
