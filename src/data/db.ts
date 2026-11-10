import Dexie, { type Table } from 'dexie';
import type { Category, Entry, Session, Settings, Snapshot, Step } from './models';

export class PlannerDB extends Dexie {
  categories!: Table<Category, string>;
  entries!: Table<Entry, string>;
  steps!: Table<Step, string>;
  sessions!: Table<Session, string>;
  settings!: Table<Settings, string>;
  constructor(name = 'personal-planner') {
    super(name);
    this.version(1).stores({
      categories: 'id, order', entries: 'id, categoryId, parentId, type, order',
      steps: 'id, projectId, order', sessions: 'id, routineId, date', settings: 'id',
    });
  }
  async snapshot(): Promise<Snapshot> {
    return this.transaction('r', this.tables, async () => {
      const [categories, entries, steps, sessions, settings] = await Promise.all([
        this.categories.orderBy('order').toArray(), this.entries.orderBy('order').toArray(),
        this.steps.orderBy('order').toArray(), this.sessions.toArray(), this.settings.toArray(),
      ]);
      return { categories, entries, steps, sessions, settings };
    });
  }
}
export const db = new PlannerDB();
