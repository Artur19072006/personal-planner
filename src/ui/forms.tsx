import { useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { Check, Trash2 } from 'lucide-react';
import { COLORS, ICONS, TYPE_LABEL, type Category, type Entry, type EntryType, type Session, type Step } from '../data/models';
import { planner } from '../data/service';
import { useAction, useData } from './context';
import { CategoryGlyph, Field, Sheet } from './primitives';

export function CategoryForm({ category, onClose }: { category?: Category; onClose: () => void }) {
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? 'book');
  const [color, setColor] = useState(category?.color ?? 'sage');
  const { run, pending } = useAction();
  const dirty = name !== (category?.name ?? '') || icon !== (category?.icon ?? 'book') || color !== (category?.color ?? 'sage');
  return <Sheet title={category ? 'Редактировать категорию' : 'Новая категория'} onClose={onClose} dirty={dirty}>
    <form onSubmit={e => { e.preventDefault(); void run(() => planner.saveCategory({ name, icon, color }, category?.id), onClose); }}>
      <Field label="Название"><input required autoFocus maxLength={250} value={name} onChange={e => setName(e.target.value)} placeholder="Например, Учёба" /></Field>
      <fieldset><legend>Иконка</legend><div className="choice-grid">{ICONS.map(value => <button type="button" key={value} aria-label={`Иконка ${value}`} aria-pressed={value === icon} className={`icon-choice ${value === icon ? 'selected' : ''}`} onClick={() => setIcon(value)}><CategoryGlyph name={value} /></button>)}</div></fieldset>
      <fieldset><legend>Цвет</legend><div className="color-choices">{COLORS.map(value => <button key={value} type="button" aria-label={`Цвет ${value}`} aria-pressed={value === color} className={`color-choice accent-${value}`} onClick={() => setColor(value)}>{value === color ? <Check size={20} /> : null}</button>)}</div></fieldset>
      <button className="button primary full" disabled={!name.trim() || pending}>Сохранить категорию</button>
    </form>
  </Sheet>;
}
export function DeleteCategory({ category, onClose, onDeleted }: { category: Category; onClose: () => void; onDeleted: () => void }) {
  const data = useData();
  const targets = data.categories.filter(c => c.id !== category.id);
  const count = data.entries.filter(e => e.categoryId === category.id && !e.parentId).length;
  const [target, setTarget] = useState(targets[0]?.id ?? '');
  const [creating, setCreating] = useState(false);
  const { run, pending } = useAction();
  if (creating) return <CategoryForm onClose={() => setCreating(false)} />;
  return <Sheet title="Удалить категорию?" onClose={onClose}>
    <p className="body-copy">Категория «{category.name}» будет удалена.{count ? ' Все записи и связанные данные будут перенесены в выбранную категорию.' : ' В ней нет записей.'}</p>
    {count ? <><Field label="Перенести записи в"><select value={target} onChange={e => setTarget(e.target.value)}><option value="" disabled>Выберите категорию</option>{targets.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><button className="text-button" onClick={() => setCreating(true)}>+ Создать категорию для переноса</button></> : null}
    <div className="form-actions"><button className="button secondary" onClick={onClose}>Отмена</button><button className="button danger" disabled={pending || Boolean(count && !target)} onClick={() => void run(() => planner.deleteCategory(category.id, target), onDeleted)}>Удалить{count ? ' и перенести' : ''}</button></div>
  </Sheet>;
}
export function EntryForm({ entry, categoryId, parentId = null, onClose, onSaved }: { entry?: Entry; categoryId?: string | null; parentId?: string | null; onClose: () => void; onSaved?: (entry: Entry) => void }) {
  const data = useData();
  const [type, setType] = useState<EntryType>(entry?.type ?? 'task');
  const [title, setTitle] = useState(entry?.title ?? '');
  const [description, setDescription] = useState(entry?.description ?? '');
  const [dueDate, setDueDate] = useState(entry?.dueDate ?? '');
  const [category, setCategory] = useState(entry?.categoryId ?? categoryId ?? '');
  const actualParent = entry?.parentId ?? parentId;
  const { run, pending } = useAction();
  const dirty = title !== (entry?.title ?? '') || description !== (entry?.description ?? '') || dueDate !== (entry?.dueDate ?? '') || category !== (entry?.categoryId ?? categoryId ?? '') || type !== (entry?.type ?? 'task');
  function submit(e: FormEvent) {
    e.preventDefault();
    void run(() => planner.saveEntry({ type, title, description, categoryId: category || null, parentId: actualParent, dueDate: dueDate || null }, entry?.id), saved => { onClose(); onSaved?.(saved); });
  }
  return <Sheet title={entry ? 'Редактировать запись' : 'Новая запись'} onClose={onClose} dirty={dirty}>
    <form onSubmit={submit}>
      {!entry && !actualParent ? <div className="type-picker" aria-label="Тип записи">{(['task', 'project', 'routine'] as const).map(value => <button type="button" key={value} aria-pressed={value === type} className={type === value ? 'selected' : ''} onClick={() => setType(value)}>{TYPE_LABEL[value]}</button>)}</div> : null}
      <Field label="Название"><input required autoFocus maxLength={250} value={title} onChange={e => setTitle(e.target.value)} placeholder={type === 'project' ? 'Что хочется сделать?' : type === 'routine' ? 'Чем хочется заниматься?' : 'Что нужно сделать?'} /></Field>
      <details open={Boolean(entry?.description || entry?.dueDate)}><summary>Дополнительные параметры</summary>
        <Field label="Описание"><textarea rows={3} maxLength={10000} value={description} onChange={e => setDescription(e.target.value)} /></Field>
        {type !== 'routine' ? <Field label="Срок · необязательно"><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />{dueDate ? <button className="text-button" type="button" onClick={() => setDueDate('')}>Убрать срок</button> : null}</Field> : null}
      </details>
      {!actualParent ? <Field label="Категория"><select required={type !== 'task'} value={category} onChange={e => setCategory(e.target.value)}><option value="">{type === 'task' ? 'Входящие · без категории' : 'Выберите категорию'}</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field> : null}
      <button className="button primary full" disabled={!title.trim() || pending || (type !== 'task' && !category)}>Сохранить</button>
    </form>
  </Sheet>;
}
export function StepForm({ projectId, step, insertAt, onClose }: { projectId: string; step?: Step; insertAt?: number; onClose: () => void }) {
  const [title, setTitle] = useState(step?.title ?? '');
  const { run, pending } = useAction();
  return <Sheet title={step ? 'Редактировать шаг' : 'Новый шаг'} onClose={onClose} dirty={title !== (step?.title ?? '')}>
    <form onSubmit={e => { e.preventDefault(); void run(() => planner.saveStep(projectId, title, step?.id, insertAt), onClose); }}>
      <Field label="Название шага"><input required autoFocus value={title} maxLength={250} onChange={e => setTitle(e.target.value)} placeholder="Одно простое действие" /></Field>
      <button className="button primary full" disabled={!title.trim() || pending}>Сохранить шаг</button>
    </form>
  </Sheet>;
}
export function SessionForm({ routineId, session, onClose }: { routineId: string; session?: Session; onClose: () => void }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(session?.date ?? today);
  const [minutes, setMinutes] = useState(session?.minutes?.toString() ?? '');
  const { run, pending } = useAction();
  const dirty = date !== (session?.date ?? today) || minutes !== (session?.minutes?.toString() ?? '');
  return <Sheet title={session ? 'Редактировать занятие' : 'Отметить занятие'} onClose={onClose} dirty={dirty}>
    <form onSubmit={e => { e.preventDefault(); void run(() => planner.saveSession({ routineId, date, minutes: minutes === '' ? null : Number(minutes) }, session?.id), onClose); }}>
      <Field label="Дата"><input required type="date" max={today} value={date} onChange={e => setDate(e.target.value)} /></Field>
      <Field label="Продолжительность · необязательно"><div className="input-suffix"><input type="number" inputMode="numeric" min={1} max={1440} step={1} value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="Без указания времени" /><span>мин</span></div></Field>
      <div className="duration-choices">{[15, 30, 45, 60, 90].map(value => <button type="button" key={value} aria-pressed={minutes === String(value)} className={minutes === String(value) ? 'selected' : ''} onClick={() => setMinutes(String(value))}>{value} мин</button>)}</div>
      {minutes ? <button type="button" className="text-button" onClick={() => setMinutes('')}>Сохранить без времени</button> : null}
      <p className="small muted">Без продолжительности сохранится только факт занятия.</p>
      <button className="button primary full" disabled={pending}>Сохранить занятие</button>
    </form>
    {session ? <button className="button danger subtle full" disabled={pending} onClick={() => { if (window.confirm('Удалить это занятие из истории и статистики?')) void run(() => planner.deleteSession(session.id), onClose); }}><Trash2 size={17} />Удалить занятие</button> : null}
  </Sheet>;
}
