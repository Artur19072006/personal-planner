import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlannerDB } from './db';
import { PlannerService } from './service';
import { history, projectLastActivity, projectProgress, routineStats } from '../domain/activity';
import { parseBackup } from './validation';

let database: PlannerDB;
let service: PlannerService;
beforeEach(() => { database = new PlannerDB(`test-${crypto.randomUUID()}`); service = new PlannerService(database); });
afterEach(async () => { await database.delete(); });
const category = (name = 'Учёба') => service.saveCategory({ name, icon: 'book', color: 'sage' });
async function plan(type: 'project' | 'routine' = 'project') { const c = await category(); return service.saveEntry({ type, title: type === 'project' ? 'Получить права' : 'Математика', description: '', categoryId: c.id, parentId: null, dueDate: null }); }

describe('tasks and completion source of truth', () => {
  it('creates stable IDs when randomUUID is unavailable in a LAN HTTP preview', async () => {
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto) });
    try {
      const task = await service.quickTask('Локальная сеть');
      expect(task.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      database.close(); await database.open();
      expect((await database.entries.get(task.id))?.title).toBe('Локальная сеть');
    } finally { vi.unstubAllGlobals(); }
  });
  it('quick-adds to inbox, completes once, restores without history residue', async () => {
    const task = await service.quickTask('  Купить тетради  ');
    expect(task.title).toBe('Купить тетради'); expect(task.categoryId).toBeNull();
    await service.toggleEntry(task.id); expect(history(await database.snapshot())).toHaveLength(1);
    await service.toggleEntry(task.id); expect((await database.entries.get(task.id))?.completedAt).toBeNull();
    expect(history(await database.snapshot())).toHaveLength(0);
  });
  it('edits and clears due date without confusing completion date', async () => {
    const task = await service.quickTask('Документы');
    await service.saveEntry({ ...task, dueDate: '2026-11-15', description: 'Паспорт' }, task.id);
    await service.toggleEntry(task.id);
    const saved = (await database.entries.get(task.id))!;
    expect(saved.dueDate).toBe('2026-11-15'); expect(saved.completedAt).not.toBe(saved.dueDate);
    await service.saveEntry({ ...saved, title: 'Отправить документы', dueDate: null }, task.id);
    expect(history(await database.snapshot())[0].title).toBe('Отправить документы');
    expect((await database.entries.get(task.id))?.dueDate).toBeNull();
    await service.deleteEntry(task.id); expect(history(await database.snapshot())).toEqual([]);
  });
  it('rejects empty titles, invalid dates and invalid locations', async () => {
    await expect(service.quickTask('   ')).rejects.toThrow();
    await expect(service.quickTask('x', 'missing')).rejects.toThrow();
    await expect(service.saveEntry({ type: 'project', title: 'x', description: '', categoryId: null, parentId: null, dueDate: null })).rejects.toThrow();
    const task = await service.quickTask('x');
    await expect(service.saveEntry({ ...task, dueDate: '2026-02-30' }, task.id)).rejects.toThrow();
  });
});
describe('categories and atomic transfer', () => {
  it('renames and reorders categories with persistent stable IDs', async () => {
    const a = await category('A'); const b = await category('B');
    await service.reorder('categories', [b.id, a.id]);
    await service.saveCategory({ name: 'Новое', color: 'blue', icon: 'heart' }, a.id);
    const saved = await database.snapshot();
    expect(saved.categories.map(c => c.id)).toEqual([b.id, a.id]);
    expect(saved.categories[1].name).toBe('Новое');
  });
  it('requires transfer for a nonempty category, preserves children, sessions and history', async () => {
    const routine = await plan('routine'); const target = await category('Личное');
    const task = await service.quickTask('Связанная задача', routine.categoryId, routine.id);
    await service.saveSession({ routineId: routine.id, date: '2026-10-20', minutes: 45 });
    await expect(service.deleteCategory(routine.categoryId!)).rejects.toThrow();
    expect(await database.categories.get(routine.categoryId!)).toBeDefined();
    await service.deleteCategory(routine.categoryId!, target.id);
    expect(await database.categories.get(routine.categoryId!)).toBeUndefined();
    expect((await database.entries.get(task.id))?.categoryId).toBe(target.id);
    expect((await database.entries.get(routine.id))?.categoryId).toBe(target.id);
    expect(history(await database.snapshot())[0].category).toBe('Личное');
  });
  it('moves a routine together with related tasks', async () => {
    const routine = await plan('routine'); const other = await category('B');
    const task = await service.quickTask('x', routine.categoryId, routine.id);
    await service.saveEntry({ ...routine, categoryId: other.id }, routine.id);
    expect((await database.entries.get(task.id))?.categoryId).toBe(other.id);
  });
  it('does not reuse occupied order after category deletion', async () => {
    const a = await category('A'); await category('B'); await category('C');
    await service.deleteCategory(a.id); await category('D');
    expect((await database.snapshot()).categories.map(c => c.order)).toEqual([1, 2, 3]);
  });
});
describe('project steps', () => {
  it('keeps completed steps in place, inserts between and preserves reordering after reopening DB', async () => {
    const project = await plan();
    const a = await service.saveStep(project.id, 'A'); const b = await service.saveStep(project.id, 'B');
    await service.toggleStep(a.id);
    const c = await service.saveStep(project.id, 'C', undefined, 1);
    expect((await database.snapshot()).steps.map(s => s.title)).toEqual(['A', 'C', 'B']);
    expect(projectProgress(await database.snapshot(), project.id)).toMatchObject({ done: 1, total: 3 });
    await service.reorder('steps', [b.id, a.id, c.id]);
    database.close(); await database.open();
    expect((await database.snapshot()).steps.map(s => s.id)).toEqual([b.id, a.id, c.id]);
    await service.toggleStep(a.id); expect(projectProgress(await database.snapshot(), project.id).done).toBe(0);
  });
  it('never auto-completes; needs explicit override for unfinished steps; can restore', async () => {
    const project = await plan();
    expect(projectProgress(await database.snapshot(), project.id).percent).toBe(0);
    const step = await service.saveStep(project.id, 'A');
    await expect(service.toggleEntry(project.id)).rejects.toThrow('невыполненные');
    await service.toggleStep(step.id);
    expect((await database.entries.get(project.id))?.completedAt).toBeNull();
    await service.toggleEntry(project.id); expect((await database.entries.get(project.id))?.completedAt).not.toBeNull();
    await service.toggleEntry(project.id); expect((await database.entries.get(project.id))?.completedAt).toBeNull();
    await service.toggleStep(step.id); await service.toggleEntry(project.id, true);
    expect((await database.entries.get(project.id))?.completedAt).not.toBeNull();
  });
  it('activity is completion-based, editing does not count; deleting cascades', async () => {
    const project = await plan(); const step = await service.saveStep(project.id, 'A');
    expect(projectLastActivity(await database.snapshot(), project.id)).toBeNull();
    await service.toggleStep(step.id); const activity = projectLastActivity(await database.snapshot(), project.id);
    await service.saveEntry({ ...project, title: 'Переименован' }, project.id);
    await service.saveStep(project.id, 'Другой шаг', step.id);
    expect(projectLastActivity(await database.snapshot(), project.id)).toBe(activity);
    await service.deleteStep(step.id); expect(projectProgress(await database.snapshot(), project.id).total).toBe(0);
    await service.saveStep(project.id, 'B'); await service.deleteEntry(project.id);
    expect(await database.steps.count()).toBe(0); expect(history(await database.snapshot())).toEqual([]);
  });
});
describe('sessions', () => {
  it('keeps null durations, same-day duplicates and derives true last activity after edits and deletion', async () => {
    const routine = await plan('routine');
    const a = await service.saveSession({ routineId: routine.id, date: '2026-10-20', minutes: null });
    const b = await service.saveSession({ routineId: routine.id, date: '2026-10-20', minutes: 45 });
    await service.saveSession({ routineId: routine.id, date: '2026-10-21', minutes: 15 });
    await service.saveEntry({ ...routine, title: 'Новая математика' }, routine.id);
    let stats = routineStats((await database.snapshot()).sessions, new Date(2026, 9, 21));
    expect(stats).toMatchObject({ last: '2026-10-21', count: 3, weekMinutes: 60, unknown: 1 });
    await service.saveSession({ ...b, date: '2026-10-22', minutes: 90 }, b.id);
    expect(history(await database.snapshot())[0]).toMatchObject({ day: '2026-10-22', title: 'Новая математика', minutes: 90 });
    await service.deleteSession(b.id);
    await service.deleteSession(a.id);
    stats = routineStats((await database.snapshot()).sessions, new Date(2026, 9, 21));
    expect(stats).toMatchObject({ last: '2026-10-21', count: 1, minutes: 15 });
  });
  it('rejects invalid duration and date, allows restoration of related tasks and cascades deletion', async () => {
    const routine = await plan('routine');
    for (const minutes of [0, -1, 1.5, 1441]) await expect(service.saveSession({ routineId: routine.id, date: '2026-10-20', minutes })).rejects.toThrow();
    await expect(service.saveSession({ routineId: routine.id, date: '2026-02-30', minutes: null })).rejects.toThrow();
    await expect(service.saveSession({ routineId: routine.id, date: '2099-01-01', minutes: null })).rejects.toThrow();
    const task = await service.quickTask('x', routine.categoryId, routine.id);
    await service.toggleEntry(task.id); await service.toggleEntry(task.id);
    expect((await database.entries.get(routine.id))?.completedAt).toBeNull();
    await service.saveSession({ routineId: routine.id, date: '2026-10-20', minutes: 30 });
    await service.deleteEntry(routine.id); expect(await database.entries.count()).toBe(0); expect(await database.sessions.count()).toBe(0);
  });
});
describe('backup and persistence', () => {
  it('round-trips all data, settings and ordering as a full replacement', async () => {
    await service.demo(); await service.setTheme('dark');
    const backup = await service.exportBackup();
    await service.clear(); expect((await database.snapshot()).entries).toEqual([]);
    await service.importBackup(JSON.parse(JSON.stringify(backup)));
    const { app: _app, schemaVersion: _version, exportedAt: _at, ...snapshot } = backup;
    expect(await database.snapshot()).toEqual(snapshot);
  });
  it('rejects unsupported versions, duplicate IDs, broken references, invalid types and dates without deleting data', async () => {
    const task = await service.quickTask('Сохранить меня'); const backup = await service.exportBackup();
    const corrupt = [
      { ...backup, schemaVersion: 2 }, {},
      { ...backup, entries: [task, task] },
      { ...backup, entries: [{ ...task, categoryId: 'missing' }] },
      { ...backup, entries: [{ ...task, parentId: task.id }] },
      { ...backup, entries: [{ ...task, type: 'routine' }] },
      { ...backup, entries: [{ ...task, dueDate: '2026-02-30' }] },
      { ...backup, sessions: [{ id: 's', createdAt: task.createdAt, updatedAt: task.updatedAt, routineId: task.id, date: '2026-10-20', minutes: null }] },
    ];
    for (const value of corrupt) { await expect(service.importBackup(value)).rejects.toThrow(); expect((await database.entries.get(task.id))?.title).toBe('Сохранить меня'); }
    expect(() => parseBackup(JSON.parse(JSON.stringify(backup)))).not.toThrow();
  });
  it('rolls back a database failure during replacement', async () => {
    const task = await service.quickTask('Исходная');
    const backup = await service.exportBackup(); backup.entries[0].title = 'Новая';
    const original = database.entries.bulkAdd.bind(database.entries);
    database.entries.bulkAdd = (() => { throw new Error('simulated write failure'); }) as typeof database.entries.bulkAdd;
    await expect(service.importBackup(backup)).rejects.toThrow('simulated');
    database.entries.bulkAdd = original;
    expect((await database.entries.get(task.id))?.title).toBe('Исходная');
  });
});
