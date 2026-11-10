import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronRight, Download, Folder, Monitor, Moon, MoreHorizontal, Plus, ShieldCheck, Smartphone, Sun, Upload } from 'lucide-react';
import type { Backup, Category } from '../data/models';
import { planner, snapshotIsEmpty } from '../data/service';
import { errorMessage, parseBackup } from '../data/validation';
import { useAction, useData, useNotify } from '../ui/context';
import { BackLink, CategoryGlyph, Empty, PageHeading, Sheet } from '../ui/primitives';
import { CategoryForm, DeleteCategory } from '../ui/forms';
import { moved, SortableItem, SortableList } from '../ui/sortable';

export function ManageCategoriesPage() {
  const data = useData();
  const [form, setForm] = useState<{ category?: Category } | null>(null);
  const [menu, setMenu] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const { run, pending } = useAction();
  const ids = data.categories.map(c => c.id); const index = menu ? ids.indexOf(menu.id) : -1;
  return <><BackLink to="/settings">Настройки</BackLink><PageHeading title="Категории" subtitle="Порядок, названия и немного цвета." /><button className="button primary" onClick={() => setForm({})}><Plus size={18} />Создать категорию</button>
    <div className="category-manage section"><SortableList ids={ids} onReorder={next => void run(() => planner.reorder('categories', next))}>{data.categories.map(category => <SortableItem key={category.id} id={category.id} label={category.name}><span className={`category-icon small-icon accent-${category.color}`}><CategoryGlyph name={category.icon} size={21} /></span><span className="row-content row-title">{category.name}</span><button className="icon-button" aria-label={`Действия с категорией: ${category.name}`} onClick={() => setMenu(category)}><MoreHorizontal size={20} /></button></SortableItem>)}</SortableList></div>
    {!ids.length ? <Empty title="Пока нет категорий"><p>Создай первую, когда она понадобится.</p></Empty> : <p className="small muted">Перетащи за точки или открой меню для перемещения выше / ниже.</p>}
    {form ? <CategoryForm category={form.category} onClose={() => setForm(null)} /> : null}
    {deleting ? <DeleteCategory category={deleting} onClose={() => setDeleting(null)} onDeleted={() => setDeleting(null)} /> : null}
    {menu ? <Sheet title={menu.name} onClose={() => setMenu(null)}><div className="menu-list"><button onClick={() => { setForm({ category: menu }); setMenu(null); }}>Редактировать категорию</button><button disabled={index === 0 || pending} onClick={() => void run(() => planner.reorder('categories', moved(ids, index, -1)), () => setMenu(null))}><ArrowUp size={17} />Переместить выше</button><button disabled={index === ids.length - 1 || pending} onClick={() => void run(() => planner.reorder('categories', moved(ids, index, 1)), () => setMenu(null))}><ArrowDown size={17} />Переместить ниже</button><button className="danger-text" onClick={() => { setDeleting(menu); setMenu(null); }}>Удалить категорию</button></div></Sheet> : null}
  </>;
}
export function SettingsPage() {
  const data = useData(); const notify = useNotify(); const { run, pending } = useAction();
  const fileInput = useRef<HTMLInputElement>(null);
  const [backup, setBackup] = useState<Backup | null>(null);
  const theme = data.settings[0]?.theme ?? 'system';
  async function exportData() {
    const value = await planner.exportBackup();
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `personal-planner-${value.exportedAt.slice(0, 10)}.json`;
    document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    notify('Резервная копия подготовлена. Сохраните файл в надёжном месте.');
  }
  async function readFile(file: File) {
    if (file.size > 20 * 1024 * 1024) { notify('Файл слишком большой. Максимальный размер — 20 МБ.'); return; }
    try { setBackup(parseBackup(JSON.parse(await file.text()))); }
    catch (error) { notify(error instanceof SyntaxError ? 'Не удалось прочитать JSON. Текущие данные сохранены.' : `Резервная копия не подходит: ${errorMessage(error)}. Текущие данные сохранены.`); }
  }
  return <><BackLink /><PageHeading title="Настройки" />
    <section className="settings-section"><h2>Оформление</h2><div className="theme-picker">{[{ value: 'light', label: 'Светлая', icon: Sun }, { value: 'dark', label: 'Тёмная', icon: Moon }, { value: 'system', label: 'Системная', icon: Monitor }].map(item => <button type="button" key={item.value} className={theme === item.value ? 'selected' : ''} aria-pressed={theme === item.value} disabled={pending} onClick={() => void run(() => planner.setTheme(item.value as 'light' | 'dark' | 'system'))}><item.icon size={20} />{item.label}</button>)}</div></section>
    <section className="settings-section"><h2>Организация</h2><Link className="setting-row" to="/settings/categories"><Folder size={20} /><span>Управление категориями</span><ChevronRight size={18} /></Link></section>
    <section className="settings-section"><h2>Резервная копия</h2><div className="settings-group"><button className="setting-row" disabled={pending} onClick={() => void run(exportData)}><Download size={20} /><span>Экспорт данных</span><ChevronRight size={18} /></button><button className="setting-row" disabled={pending} onClick={() => fileInput.current?.click()}><Upload size={20} /><span>Импорт данных</span><ChevronRight size={18} /></button></div><input hidden ref={fileInput} aria-label="Файл резервной копии" type="file" accept=".json,application/json" onChange={e => { const file = e.target.files?.[0]; if (file) void readFile(file); e.target.value = ''; }} /><p className="small muted">Экспортируй данные время от времени. Импорт полностью заменяет текущую базу после подтверждения.</p></section>
    <section className="storage-note"><ShieldCheck size={22} /><div><h2>Только на этом устройстве</h2><p>Все планы хранятся в браузере. При очистке данных сайта, удалении приложения или смене устройства они могут потеряться. Автоматической синхронизации и сервера нет.</p><p>Safari и установленная PWA на iPhone могут иметь разные хранилища. Для переноса используй экспорт и импорт.</p></div></section>
    <details className="install-help"><summary><Smartphone size={18} />Установка на iPhone</summary><ol><li>Открой приложение в Safari по HTTPS-адресу.</li><li>Нажми «Поделиться» → «На экран “Домой”» → «Добавить».</li><li>Открой приложение с нового значка. После первой загрузки основные функции доступны без интернета.</li></ol><p className="small muted">Для установки и офлайн-режима на iPhone нужен HTTPS.</p></details>
    <section className="settings-section data-management"><h2>Начало работы</h2>{snapshotIsEmpty(data) ? <button className="text-button" disabled={pending} onClick={() => void run(() => planner.demo(), () => notify('Примеры добавлены'))}>Добавить демонстрационные данные</button> : <button className="text-button danger-text" disabled={pending} onClick={() => { if (window.confirm('Удалить все категории, задачи, проекты, занятия и настройки? Это необратимо. Перед очисткой сохраните экспорт данных.')) void run(() => planner.clear(), () => notify('База очищена. Можно начать заново.')); }}>Начать с чистой базы</button>}</section>
    <p className="version">Personal Planner · версия 1.0.1<br />Без аккаунта. Без лишнего.</p>
    {backup ? <Sheet title="Восстановить резервную копию?" onClose={() => setBackup(null)}><p className="body-copy">Текущая база будет полностью заменена данными из выбранного файла. Слияние не выполняется. Сначала экспортируй текущие данные, если хочешь их сохранить.</p><dl className="fact-list"><div><dt>Категории</dt><dd>{backup.categories.length}</dd></div><div><dt>Записи</dt><dd>{backup.entries.length}</dd></div><div><dt>Шаги</dt><dd>{backup.steps.length}</dd></div><div><dt>Занятия</dt><dd>{backup.sessions.length}</dd></div></dl><div className="form-actions"><button className="button secondary" onClick={() => setBackup(null)}>Отмена</button><button className="button primary" disabled={pending} onClick={() => void run(() => planner.importBackup(backup), () => { setBackup(null); notify('Данные успешно восстановлены'); })}>Заменить и восстановить</button></div></Sheet> : null}
  </>;
}
