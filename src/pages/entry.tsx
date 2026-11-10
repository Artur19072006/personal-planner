import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, CheckCheck, ChevronRight, Clock3, MoreHorizontal, Plus, Repeat2 } from 'lucide-react';
import { planner } from '../data/service';
import type { Entry, Session, Step } from '../data/models';
import { dateLabel, minutesLabel, projectLastActivity, projectProgress, routineStats } from '../domain/activity';
import { useAction, useData } from '../ui/context';
import { BackLink, Empty, PageHeading, QuickAdd, Sheet } from '../ui/primitives';
import { EntryForm, SessionForm, StepForm } from '../ui/forms';
import { Checkbox, TaskList } from '../ui/task-list';
import { moved, SortableItem, SortableList } from '../ui/sortable';

function ProjectContent({ entry }: { entry: Entry }) {
  const data = useData(); const { run, pending } = useAction();
  const steps = data.steps.filter(s => s.projectId === entry.id);
  const progress = projectProgress(data, entry.id);
  const activity = projectLastActivity(data, entry.id);
  const [editing, setEditing] = useState<{ step?: Step; insertAt?: number } | null>(null);
  const [menu, setMenu] = useState<Step | null>(null);
  const ids = steps.map(s => s.id);
  const index = menu ? ids.indexOf(menu.id) : -1;
  function finish() {
    if (!entry.completedAt && progress.done < progress.total && !window.confirm(`Остались невыполненные шаги (${progress.total - progress.done}). Всё равно завершить проект?`)) return;
    void run(() => planner.toggleEntry(entry.id, true));
  }
  return <><div className="project-progress"><div className="progress-track" role="progressbar" aria-label="Прогресс проекта" aria-valuenow={progress.done} aria-valuemin={0} aria-valuemax={progress.total || 1}><div style={{ width: `${progress.percent}%` }} /></div><p>{progress.done} из {progress.total} шагов выполнено</p></div>
    <div className="step-list"><SortableList ids={ids} onReorder={next => void run(() => planner.reorder('steps', next))}>
      {steps.map(step => <SortableItem key={step.id} id={step.id} label={step.title}><Checkbox checked={Boolean(step.completedAt)} label={`${step.completedAt ? 'Восстановить шаг' : 'Выполнить шаг'}: ${step.title}`} disabled={pending} onChange={() => void run(() => planner.toggleStep(step.id))} /><button className={`step-title ${step.completedAt ? 'struck' : ''}`} onClick={() => setEditing({ step })}>{step.title}</button><button className="icon-button small-button" aria-label={`Действия: ${step.title}`} onClick={() => setMenu(step)}><MoreHorizontal size={19} /></button></SortableItem>)}
    </SortableList></div>
    {!steps.length ? <p className="quiet-empty">Большой план начинается с одного простого шага.</p> : null}
    <button className="text-button add-step" onClick={() => setEditing({})}><Plus size={19} />Добавить шаг</button>
    <button className={`button ${entry.completedAt ? 'primary' : 'secondary'} full project-finish`} disabled={pending} onClick={finish}>{entry.completedAt ? 'Вернуть проект в активные' : 'Завершить проект'}</button>
    {activity ? <p className="small muted activity-label">Последняя активность: {dateLabel(activity, 'd MMM yyyy')}</p> : null}
    {editing ? <StepForm projectId={entry.id} step={editing.step} insertAt={editing.insertAt} onClose={() => setEditing(null)} /> : null}
    {menu ? <Sheet title="Действия с шагом" onClose={() => setMenu(null)}><div className="menu-list"><button onClick={() => { setEditing({ step: menu }); setMenu(null); }}>Редактировать</button><button disabled={index <= 0 || pending} onClick={() => void run(() => planner.reorder('steps', moved(ids, index, -1)), () => setMenu(null))}>Переместить выше</button><button disabled={index >= ids.length - 1 || pending} onClick={() => void run(() => planner.reorder('steps', moved(ids, index, 1)), () => setMenu(null))}>Переместить ниже</button><button onClick={() => { setEditing({ insertAt: index }); setMenu(null); }}>Вставить шаг перед этим</button><button onClick={() => { setEditing({ insertAt: index + 1 }); setMenu(null); }}>Вставить шаг после этого</button><button className="danger-text" disabled={pending} onClick={() => { if (window.confirm('Удалить шаг и факт его выполнения?')) void run(() => planner.deleteStep(menu.id), () => setMenu(null)); }}>Удалить шаг</button></div></Sheet> : null}
  </>;
}
function RoutineContent({ entry }: { entry: Entry }) {
  const data = useData();
  const sessions = data.sessions.filter(s => s.routineId === entry.id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const tasks = data.entries.filter(e => e.parentId === entry.id);
  const stats = routineStats(sessions);
  const [sessionForm, setSessionForm] = useState<{ session?: Session } | null>(null);
  const [all, setAll] = useState(false);
  return <><p className="last-session">{stats.last ? `Последнее занятие: ${dateLabel(stats.last, 'd MMMM yyyy')}` : 'Пока нет отмеченных занятий'}</p>
    <button className="button primary full" onClick={() => setSessionForm({})}><Plus size={18} />Отметить занятие</button>
    <div className="routine-week"><h2>Эта неделя</h2><div><span>Занятий: {stats.weekCount}</span><span className="dot">·</span><span>{minutesLabel(stats.weekMinutes)}</span></div></div>
    <details className="routine-statistics"><summary>Больше статистики</summary><dl className="fact-list"><div><dt>В этом месяце</dt><dd>{stats.monthCount} занятий · {minutesLabel(stats.monthMinutes)}</dd></div><div><dt>За всё время</dt><dd>{stats.count} занятий · {minutesLabel(stats.minutes)}</dd></div>{stats.unknown ? <div><dt>Без указанного времени</dt><dd>{stats.unknown}</dd></div> : null}</dl></details>
    <section className="section compact"><h2>Занятия</h2>{sessions.length ? <div className="session-list">{(all ? sessions : sessions.slice(0, 5)).map(s => <button className="session-row" key={s.id} onClick={() => setSessionForm({ session: s })}><Clock3 size={18} className="muted" /><span>{dateLabel(s.date, 'd MMMM yyyy')}</span><span className="session-duration">{s.minutes === null ? 'Без времени' : minutesLabel(s.minutes)}</span><ChevronRight size={16} className="muted" /></button>)}</div> : <p className="quiet-empty">Здесь сохранится история занятий.</p>}{sessions.length > 5 ? <button className="text-button" onClick={() => setAll(!all)}>{all ? 'Свернуть' : `Показать все (${sessions.length})`}</button> : null}</section>
    <section className="section"><h2>Связанные задачи</h2><QuickAdd placeholder="Добавить связанную задачу…" draftKey={`related-${entry.id}`} onAdd={title => planner.quickTask(title, entry.categoryId, entry.id)} /><TaskList entries={tasks} /></section>
    {sessionForm ? <SessionForm routineId={entry.id} session={sessionForm.session} onClose={() => setSessionForm(null)} /> : null}
  </>;
}
export function EntryPage() {
  const { id } = useParams(); const data = useData(); const navigate = useNavigate(); const { run, pending } = useAction();
  const [editing, setEditing] = useState(false); const [menu, setMenu] = useState(false);
  const entry = data.entries.find(e => e.id === id);
  if (!entry) return <><BackLink /><Empty title="Запись не найдена"><p>Она могла быть удалена при изменении данных.</p></Empty></>;
  const category = data.categories.find(c => c.id === entry.categoryId);
  const parent = data.entries.find(e => e.id === entry.parentId);
  const back = parent ? `/entry/${parent.id}` : category ? `/category/${category.id}` : '/inbox';
  const backLabel = parent?.title ?? category?.name ?? 'Входящие';
  function remove() {
    if (!entry || !window.confirm(`Удалить «${entry.title}»${entry.type === 'task' ? '' : ' и все связанные шаги, задачи и занятия'}? Действие нельзя отменить.`)) return;
    void run(() => planner.deleteEntry(entry.id), () => navigate(back));
  }
  return <><BackLink to={back}>{backLabel}</BackLink><PageHeading title={entry.title} subtitle={entry.type === 'routine' ? undefined : `${entry.type === 'project' ? 'Проект' : 'Задача'} · ${category?.name ?? 'Входящие'}`} action={<button className="icon-button" aria-label="Действия с записью" onClick={() => setMenu(true)}><MoreHorizontal /></button>} />
    {entry.description ? <p className="description">{entry.description}</p> : null}
    {entry.dueDate ? <p className="due-date"><Clock3 size={16} />Срок: {dateLabel(entry.dueDate, 'd MMMM yyyy')}</p> : null}
    {entry.type === 'task' ? <><button className={`button ${entry.completedAt ? 'secondary' : 'primary'} full task-complete`} disabled={pending} onClick={() => void run(() => planner.toggleEntry(entry.id))}>{entry.completedAt ? <CheckCheck size={19} /> : <Check size={19} />}{entry.completedAt ? 'Вернуть в активные' : 'Выполнено'}</button><dl className="fact-list task-facts"><div><dt>Создана</dt><dd>{dateLabel(entry.createdAt, 'd MMMM yyyy')}</dd></div>{entry.completedAt ? <div><dt>Выполнена</dt><dd>{dateLabel(entry.completedAt, 'd MMMM yyyy')}</dd></div> : null}</dl><button className="text-button" onClick={() => setEditing(true)}>Редактировать задачу</button></> : entry.type === 'project' ? <ProjectContent entry={entry} /> : <RoutineContent entry={entry} />}
    {editing ? <EntryForm entry={entry} onClose={() => setEditing(false)} /> : null}
    {menu ? <Sheet title="Действия с записью" onClose={() => setMenu(false)}><div className="menu-list"><button onClick={() => { setMenu(false); setEditing(true); }}>Редактировать{!parent ? ' / переместить' : ''}</button>{entry.type === 'routine' ? <Link to="/history"><Repeat2 size={17} />Открыть общую историю</Link> : null}<button className="danger-text" disabled={pending} onClick={remove}>Удалить запись</button></div></Sheet> : null}
  </>;
}
