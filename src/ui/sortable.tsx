import { type CSSProperties, type ReactNode } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

export function SortableList({ ids, onReorder, children }: { ids: string[]; onReorder: (ids: string[]) => void; children: ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function end(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const from = ids.indexOf(String(event.active.id)); const to = ids.indexOf(String(event.over.id));
    if (from >= 0 && to >= 0) onReorder(arrayMove(ids, from, to));
  }
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={end} accessibility={{
    screenReaderInstructions: { draggable: 'Нажмите пробел, затем стрелки для перемещения. Пробел — сохранить, Escape — отменить.' },
    announcements: {
      onDragStart: ({ active }) => `Выбран элемент ${ids.indexOf(String(active.id)) + 1} из ${ids.length}`,
      onDragOver: ({ over }) => over ? `Позиция ${ids.indexOf(String(over.id)) + 1} из ${ids.length}` : 'За пределами списка',
      onDragEnd: ({ over }) => over ? `Перемещение в позицию ${ids.indexOf(String(over.id)) + 1}` : 'Перемещение отменено',
      onDragCancel: () => 'Перемещение отменено',
    },
  }}><SortableContext items={ids} strategy={verticalListSortingStrategy}>{children}</SortableContext></DndContext>;
}
export function SortableItem({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition, position: 'relative', zIndex: isDragging ? 2 : undefined, opacity: isDragging ? 0.8 : 1 };
  return <div ref={setNodeRef} style={style} className={`sortable-item ${isDragging ? 'dragging' : ''}`}><button type="button" className="drag-handle" {...attributes} {...listeners} aria-label={`Перетащить: ${label}`}><GripVertical size={19} /></button>{children}</div>;
}
export function moved(ids: string[], index: number, direction: -1 | 1) { return arrayMove(ids, index, index + direction); }
