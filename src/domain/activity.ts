import { addWeeks, format, isSameDay, parseISO, startOfWeek, subDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Entry, Session, Snapshot } from '../data/models';

export interface Activity { id: string; kind: 'task' | 'step' | 'session' | 'project'; title: string; category: string; context: string; entryId: string; at: string; day: string; minutes: number | null }
export const dayKey = (date: Date) => format(date, 'yyyy-MM-dd');
export const localDate = (value: string) => parseISO(value);
export function history(data: Snapshot): Activity[] {
  const entries = new Map(data.entries.map(e => [e.id, e]));
  const categories = new Map(data.categories.map(c => [c.id, c.name]));
  const category = (entry: Entry) => entry.categoryId ? categories.get(entry.categoryId) ?? 'Категория' : 'Входящие';
  const rows: Activity[] = [];
  for (const entry of data.entries) if (entry.completedAt) {
    const parent = entry.parentId ? entries.get(entry.parentId) : null;
    rows.push({ id: entry.id, kind: entry.type === 'project' ? 'project' : 'task', title: entry.title, category: category(entry), context: parent?.title ?? (entry.type === 'project' ? 'Проект завершён' : 'Задача выполнена'), entryId: parent?.id ?? entry.id, at: entry.completedAt, day: dayKey(parseISO(entry.completedAt)), minutes: null });
  }
  for (const step of data.steps) if (step.completedAt) {
    const project = entries.get(step.projectId);
    if (project) rows.push({ id: step.id, kind: 'step', title: step.title, category: category(project), context: project.title, entryId: project.id, at: step.completedAt, day: dayKey(parseISO(step.completedAt)), minutes: null });
  }
  for (const session of data.sessions) {
    const routine = entries.get(session.routineId);
    if (routine) rows.push({ id: session.id, kind: 'session', title: routine.title, category: category(routine), context: 'Занятие', entryId: routine.id, at: `${session.date}T${format(parseISO(session.createdAt), 'HH:mm:ss')}`, day: session.date, minutes: session.minutes });
  }
  return rows.sort((a, b) => b.day.localeCompare(a.day) || parseISO(b.at).getTime() - parseISO(a.at).getTime() || a.id.localeCompare(b.id));
}
export function weekRange(date: Date) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return { start, end: addWeeks(start, 1), from: dayKey(start), to: dayKey(addWeeks(start, 1)) };
}
export function weekStats(data: Snapshot, date: Date) {
  const { from, to } = weekRange(date);
  const rows = history(data).filter(row => row.day >= from && row.day < to);
  return { tasks: rows.filter(r => r.kind === 'task').length, steps: rows.filter(r => r.kind === 'step').length, sessions: rows.filter(r => r.kind === 'session').length, minutes: rows.reduce((sum, r) => sum + (r.minutes ?? 0), 0) };
}
export function routineStats(sessions: Session[], now = new Date()) {
  const { from, to } = weekRange(now);
  const month = format(now, 'yyyy-MM');
  const week = sessions.filter(s => s.date >= from && s.date < to);
  const monthRows = sessions.filter(s => s.date.startsWith(month));
  const sum = (rows: Session[]) => rows.reduce((value, row) => value + (row.minutes ?? 0), 0);
  return { last: sessions.map(s => s.date).sort().at(-1) ?? null, weekCount: week.length, weekMinutes: sum(week), monthCount: monthRows.length, monthMinutes: sum(monthRows), count: sessions.length, minutes: sum(sessions), unknown: sessions.filter(s => s.minutes === null).length };
}
export function projectProgress(data: Snapshot, id: string) {
  const steps = data.steps.filter(s => s.projectId === id);
  const done = steps.filter(s => s.completedAt).length;
  return { total: steps.length, done, percent: steps.length ? done / steps.length * 100 : 0 };
}
export function projectLastActivity(data: Snapshot, id: string) {
  return [data.entries.find(e => e.id === id)?.completedAt, ...data.steps.filter(s => s.projectId === id).map(s => s.completedAt)].filter((s): s is string => Boolean(s)).sort().at(-1) ?? null;
}
export function minutesLabel(minutes: number) { return minutes < 60 ? `${minutes} мин` : `${Math.floor(minutes / 60)} ч${minutes % 60 ? ` ${minutes % 60} мин` : ''}`; }
export function dateLabel(value: string, pattern = 'd MMMM') { return format(parseISO(value), pattern, { locale: ru }); }
export function dayLabel(value: string, now = new Date()) {
  const date = parseISO(value);
  if (isSameDay(date, now)) return 'Сегодня';
  if (isSameDay(date, subDays(now, 1))) return 'Вчера';
  return dateLabel(value, date.getFullYear() === now.getFullYear() ? 'd MMMM' : 'd MMMM yyyy');
}
