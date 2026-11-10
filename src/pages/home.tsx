import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, FolderOpen, MoreHorizontal, Plus } from 'lucide-react';
import { useAction, useData, useNotify } from '../ui/context';
import { CategoryGlyph, BackLink, Empty, PageHeading, Sheet } from '../ui/primitives';
import { CategoryForm, DeleteCategory, EntryForm } from '../ui/forms';
import { EntryRow, TaskList } from '../ui/task-list';
import { planner } from '../data/service';
import { snapshotIsEmpty } from '../data/service';

export function HomePage() {
  const data = useData();
  const [creating, setCreating] = useState(false);
  const { run, pending } = useAction();
  const notify = useNotify();
  return <><PageHeading title="Мои планы" subtitle="Всё важное — на своём месте." />
    <section className="section"><div className="section-heading"><h2>Категории</h2><button className="text-button" onClick={() => setCreating(true)}><Plus size={18} />Создать</button></div>
      {data.categories.length ? <div className="category-list">{data.categories.map(c => {
        const count = data.entries.filter(e => e.categoryId === c.id && !e.parentId && !e.completedAt).length;
        return <Link className="category-card" key={c.id} to={`/category/${c.id}`}><span className={`category-icon accent-${c.color}`}><CategoryGlyph name={c.icon} size={27} /></span><div className="row-content"><span className="category-name">{c.name}</span><span className="row-caption">{count ? `Активных записей: ${count}` : 'Пока нет активных записей'}</span></div><ChevronRight size={21} className="muted" /></Link>;
      })}</div> : <Empty icon={<FolderOpen size={32} />} title="Здесь будут твои планы"><p>Создай первую категорию для проектов и регулярных занятий.</p><button className="button primary" onClick={() => setCreating(true)}><Plus size={18} />Создать категорию</button></Empty>}
    </section>
    {snapshotIsEmpty(data) ? <div className="first-start"><p>Хочется сначала посмотреть, как всё устроено?</p><button className="text-button" disabled={pending} onClick={() => void run(() => planner.demo(), () => notify('Примеры добавлены. Их можно удалить в настройках.'))}>Попробовать с примерами</button><span className="small muted">Или просто начни с чистой базы — она уже готова.</span></div> : null}
    {creating ? <CategoryForm onClose={() => setCreating(false)} /> : null}
  </>;
}
export function CategoryPage() {
  const { id } = useParams(); const data = useData(); const navigate = useNavigate();
  const category = data.categories.find(c => c.id === id);
  const [modal, setModal] = useState<'new' | 'menu' | 'edit' | 'delete' | null>(null);
  const [showDone, setShowDone] = useState(false);
  if (!category) return <><BackLink /><Empty title="Категория не найдена"><p>Возможно, она была удалена или перенесена.</p></Empty></>;
  const entries = data.entries.filter(e => e.categoryId === id && !e.parentId);
  const plans = entries.filter(e => e.type !== 'task' && !e.completedAt);
  const completed = entries.filter(e => e.type === 'project' && e.completedAt);
  return <><BackLink /><PageHeading title={category.name} subtitle="Задачи, проекты и регулярные занятия." action={<button className="icon-button" aria-label="Действия с категорией" onClick={() => setModal('menu')}><MoreHorizontal /></button>} />
    <button className="button primary" onClick={() => setModal('new')}><Plus size={18} />Новая запись</button>
    <section className="section">{plans.length ? <div className="entry-list">{plans.map(e => <EntryRow entry={e} key={e.id} />)}</div> : null}<TaskList entries={entries.filter(e => e.type === 'task')} />
      {!entries.length ? <Empty icon={<CategoryGlyph name={category.icon} size={32} />} title="Место для новых планов"><p>Добавь задачу, проект или регулярное направление.</p></Empty> : null}
      {completed.length ? <div className="completed-section"><button className="disclosure" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>Завершённые проекты <span className="count">{completed.length}</span></button>{showDone ? completed.map(e => <EntryRow key={e.id} entry={e} />) : null}</div> : null}
    </section>
    {modal === 'new' ? <EntryForm categoryId={category.id} onClose={() => setModal(null)} /> : null}
    {modal === 'edit' ? <CategoryForm category={category} onClose={() => setModal(null)} /> : null}
    {modal === 'delete' ? <DeleteCategory category={category} onClose={() => setModal(null)} onDeleted={() => navigate('/')} /> : null}
    {modal === 'menu' ? <Sheet title="Категория" onClose={() => setModal(null)}><div className="menu-list"><button onClick={() => setModal('edit')}>Изменить название, иконку и цвет</button><Link to="/settings/categories">Изменить порядок категорий</Link><button className="danger-text" onClick={() => setModal('delete')}>Удалить категорию</button></div></Sheet> : null}
  </>;
}
