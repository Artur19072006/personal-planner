import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addWeeks, subDays, subWeeks } from 'date-fns';
import { BarChart3, Check, CheckCheck, ChevronLeft, ChevronRight, Clock3, Flag, History, ListChecks } from 'lucide-react';
import { dateLabel, dayKey, dayLabel, history, minutesLabel, weekRange, weekStats } from '../domain/activity';
import { useData } from '../ui/context';
import { Empty, PageHeading } from '../ui/primitives';

export function HistoryPage() {
  const data = useData();
  const [statistics, setStatistics] = useState(false);
  const [selectedWeek, setWeek] = useState<Date | null>(null);
  const week = selectedWeek ?? new Date();
  const [limit, setLimit] = useState(60);
  const events = useMemo(() => history(data), [data]);
  const stats = weekStats(data, week); const previous = weekStats(data, subWeeks(week, 1));
  const range = weekRange(week);
  const rows = events.slice(0, limit);
  const icons = { task: Check, step: ListChecks, session: Clock3, project: Flag };
  const labels = { task: 'Задача', step: 'Шаг проекта', session: 'Занятие', project: 'Проект завершён' };
  return <><PageHeading title="История" subtitle="Сделанное остаётся здесь." action={<button className={`icon-button ${statistics ? 'active' : ''}`} aria-label="Статистика" aria-expanded={statistics} onClick={() => setStatistics(!statistics)}><BarChart3 size={23} /></button>} />
    <button className="text-button statistics-toggle" aria-expanded={statistics} onClick={() => setStatistics(!statistics)}><BarChart3 size={17} />{statistics ? 'Скрыть статистику' : 'Недельная статистика'}</button>
    {statistics ? <section className="statistics-panel"><div className="week-selector"><button className="icon-button" aria-label="Предыдущая неделя" onClick={() => setWeek(subWeeks(week, 1))}><ChevronLeft size={20} /></button><div><h2>{dateLabel(dayKey(range.start), 'd MMM')} — {dateLabel(dayKey(subDays(range.end, 1)), 'd MMM yyyy')}</h2><button className="text-button small" onClick={() => setWeek(null)}>Текущая неделя</button></div><button className="icon-button" aria-label="Следующая неделя" onClick={() => setWeek(addWeeks(week, 1))}><ChevronRight size={20} /></button></div>
      <div className="stats-grid">{[{ title: 'Задачи', value: stats.tasks, before: previous.tasks, icon: CheckCheck }, { title: 'Шаги проектов', value: stats.steps, before: previous.steps, icon: ListChecks }, { title: 'Занятия', value: stats.sessions, before: previous.sessions, icon: Clock3 }, { title: 'Известное время', value: minutesLabel(stats.minutes), before: minutesLabel(previous.minutes), icon: BarChart3 }].map(item => <div className="stat" key={item.title}><item.icon size={18} /><span className="stat-value">{item.value}</span><span>{item.title}</span><small>Прошлая неделя: {item.before}</small></div>)}</div>
      <details><summary>По направлениям</summary>{data.entries.filter(e => e.type === 'routine').length ? data.entries.filter(e => e.type === 'routine').map(entry => { const sessions = data.sessions.filter(s => s.routineId === entry.id && s.date >= range.from && s.date < range.to); return <div className="breakdown-row" key={entry.id}><Link to={`/entry/${entry.id}`}>{entry.title}</Link><span>{sessions.length} занятий · {minutesLabel(sessions.reduce((sum, s) => sum + (s.minutes ?? 0), 0))}</span></div>; }) : <p className="small muted">Пока нет регулярных направлений.</p>}</details><p className="small muted">Занятия без продолжительности входят в количество; время учитывается только указанное.</p>
    </section> : null}
    {!events.length ? <Empty icon={<History size={32} />} title="История начинается с действия"><p>Выполни задачу или отметь занятие —<br />и запись появится здесь.</p></Empty> : <div className="history-list">{rows.map((event, index) => { const Icon = icons[event.kind]; return <div key={event.id}>{index === 0 || rows[index - 1].day !== event.day ? <h2 className="day-heading">{dayLabel(event.day)}</h2> : null}<Link className="history-row" to={`/entry/${event.entryId}`}><span className={`history-icon ${event.kind}`}><Icon size={19} /></span><span className="row-content"><span className="row-title">{event.title}</span><span className="row-caption">{event.category} · {labels[event.kind]}{event.kind === 'step' ? ` · ${event.context}` : ''}{event.kind === 'session' ? event.minutes === null ? ' · Без времени' : ` · ${minutesLabel(event.minutes)}` : ''}</span></span><ChevronRight size={16} className="muted" /></Link></div>; })}{events.length > limit ? <button className="button secondary full" onClick={() => setLimit(limit + 60)}>Показать ещё</button> : null}</div>}
  </>;
}
