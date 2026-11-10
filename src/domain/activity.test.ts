import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../data/models';
import { dayKey, history, minutesLabel, routineStats, weekRange, weekStats } from './activity';

const timestamp = '2026-10-01T10:00:00.000Z';
function fixture(): Snapshot {
  return {
    categories: [{ id: 'c', name: 'Учёба', icon: 'book', color: 'sage', order: 0, createdAt: timestamp, updatedAt: timestamp }],
    entries: [
      { id: 'r', title: 'Математика', type: 'routine', description: '', categoryId: 'c', parentId: null, dueDate: null, completedAt: null, order: 0, createdAt: timestamp, updatedAt: timestamp },
      { id: 't', title: 'Задача', type: 'task', description: '', categoryId: null, parentId: null, dueDate: '2026-12-01', completedAt: '2026-10-20T10:00:00.000Z', order: 1, createdAt: timestamp, updatedAt: timestamp },
      { id: 'p', title: 'Проект', type: 'project', description: '', categoryId: 'c', parentId: null, dueDate: null, completedAt: null, order: 2, createdAt: timestamp, updatedAt: timestamp },
    ],
    steps: [{ id: 's', title: 'Шаг', projectId: 'p', order: 0, completedAt: '2026-10-21T10:00:00.000Z', createdAt: timestamp, updatedAt: timestamp }],
    sessions: [
      { id: 'a', routineId: 'r', date: '2026-10-19', minutes: 45, createdAt: timestamp, updatedAt: timestamp },
      { id: 'b', routineId: 'r', date: '2026-10-25', minutes: null, createdAt: timestamp, updatedAt: timestamp },
      { id: 'c', routineId: 'r', date: '2026-10-18', minutes: 60, createdAt: timestamp, updatedAt: timestamp },
      { id: 'd', routineId: 'r', date: '2026-10-26', minutes: 15, createdAt: timestamp, updatedAt: timestamp },
    ], settings: [],
  };
}
describe('activity and weekly statistics', () => {
  it('uses Monday-inclusive and next-Monday-exclusive local date bounds', () => {
    const date = new Date(2026, 9, 25, 23, 59);
    const range = weekRange(date);
    expect(range.from).toBe('2026-10-19'); expect(range.to).toBe('2026-10-26');
    expect(weekStats(fixture(), date)).toEqual({ tasks: 1, steps: 1, sessions: 2, minutes: 45 });
    expect(weekStats(fixture(), new Date(2026, 9, 18))).toEqual({ tasks: 0, steps: 0, sessions: 1, minutes: 60 });
  });
  it('sorts backdated sessions by the session day, recomputes restored tasks and removes deleted sources', () => {
    const data = fixture(); expect(history(data)[0].day).toBe('2026-10-26');
    data.entries[1].completedAt = null; expect(weekStats(data, new Date(2026, 9, 21)).tasks).toBe(0);
    data.sessions[0].date = '2026-10-18'; expect(weekStats(data, new Date(2026, 9, 21)).minutes).toBe(0);
    data.entries = []; expect(history(data)).toEqual([]);
  });
  it('counts month and all-time facts and displays only known minutes', () => {
    const stats = routineStats(fixture().sessions, new Date(2026, 9, 21));
    expect(stats).toMatchObject({ monthCount: 4, monthMinutes: 120, count: 4, minutes: 120, unknown: 1 });
    expect(minutesLabel(0)).toBe('0 мин'); expect(minutesLabel(90)).toBe('1 ч 30 мин');
  });
  it('handles weeks crossing a year without UTC-shifting date-only values', () => {
    expect(weekRange(new Date(2027, 0, 1))).toMatchObject({ from: '2026-12-28', to: '2027-01-04' });
    expect(dayKey(new Date(2026, 9, 25, 0, 1))).toBe('2026-10-25');
  });
});
