import { Children, cloneElement, isValidElement, useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react';
import { useBlocker } from 'react-router-dom';
import { ArrowLeft, BookOpen, BriefcaseBusiness, Dumbbell, Folder, Globe, Heart, Leaf, Music2, Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CategoryIcon } from '../data/models';
import { useAction, useDraft, useMessage, useNotify } from './context';

const iconMap = { book: BookOpen, dumbbell: Dumbbell, folder: Folder, heart: Heart, briefcase: BriefcaseBusiness, leaf: Leaf, music: Music2, globe: Globe };
export function CategoryGlyph({ name, size = 24 }: { name: CategoryIcon; size?: number }) { const Icon = iconMap[name]; return <Icon size={size} strokeWidth={1.7} />; }
export function BackLink({ to = '/', children = 'Главная' }: { to?: string; children?: ReactNode }) { return <Link className="back-link" to={to}><ArrowLeft size={18} />{children}</Link>; }
export function PageHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) { return <div className="page-heading"><div><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>{action}</div>; }
export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) { return <div className="empty">{icon ? <div className="empty-icon">{icon}</div> : null}<h3>{title}</h3>{children}</div>; }
export function Sheet({ title, children, onClose, dirty = false }: { title: string; children: ReactNode; onClose: () => void; dirty?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const message = useMessage();
  const notify = useNotify();
  const blocker = useBlocker(() => dirty && Boolean(ref.current?.open));
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); notify(''); return () => dialog?.close(); }, [notify]);
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm('Изменения не сохранены. Закрыть форму и потерять изменения?')) { closeRef.current(); blocker.proceed(); }
      else blocker.reset();
    }
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  function close() { if (!dirty || window.confirm('Изменения не сохранены. Закрыть форму и потерять изменения?')) onClose(); }
  return <dialog ref={ref} className="sheet" aria-labelledby={headingId} onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === ref.current) { const box = ref.current.getBoundingClientRect(); if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) close(); } }}>
    <div className="sheet-header"><h2 id={headingId}>{title}</h2><button className="icon-button" type="button" aria-label="Закрыть форму" onClick={close}><X size={22} /></button></div>
    {children}
    {message ? <p className="sheet-message" role="status">{message}</p> : null}
  </dialog>;
}
export function QuickAdd({ placeholder = 'Новая задача…', draftKey, onAdd }: { placeholder?: string; draftKey: string; onAdd: (title: string) => Promise<unknown> }) {
  const [title, setTitle] = useDraft(draftKey);
  const { run, pending } = useAction();
  function submit(e: FormEvent) { e.preventDefault(); if (title.trim()) void run(() => onAdd(title), () => setTitle(current => current === title ? '' : current)); }
  return <form className="quick-add" onSubmit={submit}>
    <input aria-label={placeholder} placeholder={placeholder} maxLength={250} value={title} onChange={e => setTitle(e.target.value)} autoComplete="off" />
    <button type="submit" className="button primary square" disabled={!title.trim() || pending} aria-label="Добавить задачу"><Plus size={24} /></button>
  </form>;
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  function bind(nodes: ReactNode): ReactNode {
    return Children.map(nodes, node => {
      if (!isValidElement<{ id?: string; children?: ReactNode }>(node)) return node;
      if (node.type === 'input' || node.type === 'textarea' || node.type === 'select') return cloneElement(node, { id });
      return node.props.children ? cloneElement(node, { children: bind(node.props.children) }) : node;
    });
  }
  return <div className="field"><label htmlFor={id}>{label}</label>{bind(children)}</div>;
}
