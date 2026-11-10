import { useDeferredValue, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Search } from 'lucide-react';
import { TYPE_LABEL } from '../data/models';
import { useData } from '../ui/context';
import { BackLink, Empty, PageHeading } from '../ui/primitives';

export function SearchPage() {
  const data = useData(); const [query, setQuery] = useState(''); const term = useDeferredValue(query.trim().toLocaleLowerCase('ru'));
  const categories = new Map(data.categories.map(c => [c.id, c.name]));
  const results = term ? data.entries.filter(e => `${e.title} ${e.description}`.toLocaleLowerCase('ru').includes(term)) : [];
  return <><BackLink /><PageHeading title="Поиск" /><div className="search-field"><Search size={20} /><input type="search" autoFocus aria-label="Поиск по планам" placeholder="Название или описание…" value={query} onChange={e => setQuery(e.target.value)} /></div>
    {term && !results.length ? <Empty title="Ничего не нашлось"><p>Попробуй другое слово.</p></Empty> : null}
    {!term ? <p className="quiet-empty">Поиск по задачам, проектам и направлениям.</p> : <p className="small muted" role="status">Найдено: {results.length}</p>}
    <div className="entry-list">{results.map(e => <Link key={e.id} className="entry-row search-result" to={`/entry/${e.id}`}><div className="row-content"><span className="row-title">{e.title}</span><span className="row-caption">{TYPE_LABEL[e.type]} · {e.categoryId ? categories.get(e.categoryId) : 'Входящие'}{e.completedAt ? ' · Выполнено' : ''}</span></div><ChevronRight size={17} /></Link>)}</div>
  </>;
}
