export const ICONS = ['book', 'dumbbell', 'folder', 'heart', 'briefcase', 'leaf', 'music', 'globe'] as const;
export const COLORS = ['sage', 'blue', 'lavender', 'peach', 'rose', 'sand'] as const;
export type CategoryIcon = typeof ICONS[number];
export type CategoryColor = typeof COLORS[number];
export type EntryType = 'task' | 'project' | 'routine';
export interface Base { id: string; createdAt: string; updatedAt: string }
export interface Category extends Base { name: string; icon: CategoryIcon; color: CategoryColor; order: number }
export interface Entry extends Base {
  type: EntryType;
  title: string;
  description: string;
  categoryId: string | null;
  parentId: string | null;
  dueDate: string | null;
  completedAt: string | null;
  order: number;
}
export interface Step extends Base { projectId: string; title: string; completedAt: string | null; order: number }
export interface Session extends Base { routineId: string; date: string; minutes: number | null }
export interface Settings { id: 'preferences'; theme: 'system' | 'light' | 'dark' }
export interface Snapshot { categories: Category[]; entries: Entry[]; steps: Step[]; sessions: Session[]; settings: Settings[] }
export interface Backup extends Snapshot { app: 'personal-planner'; schemaVersion: 1; exportedAt: string }
export const EMPTY: Snapshot = { categories: [], entries: [], steps: [], sessions: [], settings: [] };
export const TYPE_LABEL: Record<EntryType, string> = { task: 'Задача', project: 'Проект', routine: 'Регулярное направление' };
