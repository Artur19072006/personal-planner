import { Inbox } from 'lucide-react';
import { planner } from '../data/service';
import { useData } from '../ui/context';
import { Empty, PageHeading, QuickAdd } from '../ui/primitives';
import { TaskList } from '../ui/task-list';

export function InboxPage() {
  const data = useData();
  const tasks = data.entries.filter(e => e.type === 'task' && !e.categoryId && !e.parentId);
  return <><PageHeading title="Входящие" subtitle="Простые задачи на каждый день." />
    <QuickAdd draftKey="inbox-quick-add" onAdd={title => planner.quickTask(title)} />
    {tasks.length ? <TaskList entries={tasks} empty="Все текущие задачи выполнены." /> : <Empty icon={<Inbox size={32} />} title="Ничего не потеряется"><p>Запиши то, о чём хочется вспомнить.<br />Задачам здесь не нужна категория.</p></Empty>}
    {tasks.some(e => !e.completedAt) ? <p className="gesture-hint">Отметь кружок или смахни задачу вправо.</p> : null}
  </>;
}
