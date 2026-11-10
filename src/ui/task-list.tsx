import { useRef, useState, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, ChevronRight, CircleCheck, Folder, Repeat2 } from 'lucide-react';
import type { Entry } from '../data/models';
import { planner } from '../data/service';
import { dateLabel, projectProgress, routineStats } from '../domain/activity';
import { useAction, useData } from './context';

export function Checkbox({ checked, label, onChange, disabled }: { checked: boolean; label: string; onChange: () => void; disabled?: boolean }) {
  return <button type="button" role="checkbox" aria-checked={checked} aria-label={label} className={`checkbox ${checked ? 'checked' : ''}`} disabled={disabled} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onChange(); }}>{checked ? <Check size={15} strokeWidth={2.5} /> : null}</button>;
}
export function TaskRow({ entry }: { entry: Entry }) {
  const { run, pending } = useAction();
  const start = useRef<{ x: number; y: number; swiping: boolean } | null>(null);
  const suppress = useRef(false);
  const offsetRef = useRef(0);
  const [offset, setOffset] = useState(0);
  function move(e: PointerEvent<HTMLDivElement>) {
    const point = start.current;
    if (!point || e.pointerType === 'mouse') return;
    const dx = e.clientX - point.x; const dy = e.clientY - point.y;
    if (Math.abs(dy) > 24 && !point.swiping) { start.current = null; return; }
    if (dx > 12 && Math.abs(dx) > Math.abs(dy) * 1.8) {
      point.swiping = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* A cancelled pointer may no longer be active. */ }
      offsetRef.current = Math.min(dx, 110); setOffset(offsetRef.current);
    }
  }
  function end() {
    if (offsetRef.current > 75 && start.current) { suppress.current = true; void run(() => planner.toggleEntry(entry.id)); setTimeout(() => { suppress.current = false; }, 250); }
    offsetRef.current = 0; setOffset(0); start.current = null;
  }
  return <div className="swipe-wrap"><div className="swipe-under" aria-hidden="true" style={{ opacity: offset > 0 ? 1 : 0 }}><Check size={20} /></div>
    <div className={`task-row ${entry.completedAt ? 'is-done' : ''}`} style={{ transform: `translateX(${offset}px)` }} onPointerDown={e => { if (e.pointerType !== 'mouse') { offsetRef.current = 0; start.current = { x: e.clientX, y: e.clientY, swiping: false }; } }} onPointerMove={move} onPointerUp={end} onPointerCancel={() => { start.current = null; offsetRef.current = 0; setOffset(0); }}>
      <Checkbox checked={Boolean(entry.completedAt)} label={`${entry.completedAt ? 'Восстановить' : 'Выполнить'}: ${entry.title}`} disabled={pending} onChange={() => void run(() => planner.toggleEntry(entry.id))} />
      <Link to={`/entry/${entry.id}`} className="row-content" onClick={e => { if (suppress.current || offset > 10) e.preventDefault(); }}><span className="row-title">{entry.title}</span>{entry.dueDate ? <span className="row-caption">до {dateLabel(entry.dueDate, 'd MMM yyyy')}</span> : null}</Link>
    </div></div>;
}
export function TaskList({ entries, empty }: { entries: Entry[]; empty?: string }) {
  const [expanded, setExpanded] = useState(false);
  const active = entries.filter(e => !e.completedAt);
  const done = entries.filter(e => e.completedAt).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  return <><div className="task-list">{active.map(entry => <TaskRow key={entry.id} entry={entry} />)}</div>
    {!active.length && empty ? <p className="quiet-empty">{empty}</p> : null}
    {done.length ? <div className="completed-section"><button className="disclosure" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><ChevronDown size={19} className={expanded ? '' : 'rotate-closed'} />Выполненные <span className="count">{done.length}</span></button>{expanded ? <div className="task-list">{done.map(entry => <TaskRow key={entry.id} entry={entry} />)}</div> : null}</div> : null}
  </>;
}
export function EntryRow({ entry }: { entry: Entry }) {
  const data = useData();
  if (entry.type === 'task') return <TaskRow entry={entry} />;
  const progress = projectProgress(data, entry.id);
  const stats = routineStats(data.sessions.filter(s => s.routineId === entry.id));
  const Icon = entry.type === 'routine' ? Repeat2 : entry.completedAt ? CircleCheck : Folder;
  return <Link to={`/entry/${entry.id}`} className="entry-row"><div className={`entry-icon ${entry.type}`}><Icon size={22} strokeWidth={1.7} /></div><div className="row-content"><span className="row-title">{entry.title}</span><span className="row-caption">{entry.type === 'routine' ? stats.last ? `Последнее занятие: ${dateLabel(stats.last)}` : 'Пока без занятий' : entry.completedAt ? 'Проект завершён' : `${progress.done} из ${progress.total} шагов выполнено`}</span></div><ChevronRight size={19} className="muted" /></Link>;
}
