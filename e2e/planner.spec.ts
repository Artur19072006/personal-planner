import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const messages: string[] = []; errors.set(page, messages);
  page.on('pageerror', error => messages.push(error.message));
  page.on('console', message => { if (message.type() === 'error') messages.push(message.text()); });
  await page.clock.setFixedTime(new Date('2026-11-08T10:00:00+02:00'));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Мои планы' })).toBeVisible();
  await expect(page).toHaveTitle('Personal Planner');
});
test.afterEach(async ({ page }) => { expect(errors.get(page) ?? []).toEqual([]); });

async function createCategory(page: Page, name: string) {
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Название', { exact: true }).fill(name);
  await dialog.getByRole('button', { name: 'Сохранить категорию' }).click();
  await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
}
async function demo(page: Page) {
  await page.getByRole('button', { name: 'Попробовать с примерами' }).click();
  await expect(page.getByRole('link', { name: /Учёба/ })).toBeVisible();
}
async function newPlan(page: Page, type: 'Проект' | 'Регулярное направление', title: string) {
  await page.getByRole('button', { name: 'Новая запись' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: type, exact: true }).click();
  await dialog.getByLabel('Название', { exact: true }).fill(title);
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.getByRole('link', { name: new RegExp(title) }).click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}
async function addStep(page: Page, title: string) {
  await page.getByRole('button', { name: 'Добавить шаг', exact: true }).click();
  await page.getByLabel('Название шага').fill(title);
  await page.getByRole('button', { name: 'Сохранить шаг' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible();
}
async function addSession(page: Page, date: string, minutes?: string) {
  await page.getByRole('button', { name: 'Отметить занятие', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Дата', { exact: true }).fill(date);
  if (minutes) await dialog.getByLabel('Продолжительность · необязательно').fill(minutes);
  await dialog.getByRole('button', { name: 'Сохранить занятие' }).click();
  await expect(dialog).not.toBeVisible();
}

test('empty start, category create/edit/order/transfer/delete', async ({ page }) => {
  await expect(page.getByText('Здесь будут твои планы')).toBeVisible();
  await createCategory(page, 'Учёба'); await createCategory(page, 'Личное');
  await page.getByRole('link', { name: /Учёба/ }).click();
  await page.getByRole('button', { name: 'Новая запись' }).click();
  await page.getByRole('dialog').getByLabel('Название', { exact: true }).fill('Отправить документы');
  await page.getByRole('dialog').getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.getByRole('button', { name: 'Действия с категорией' }).click();
  await page.getByRole('button', { name: 'Изменить название, иконку и цвет' }).click();
  await page.getByLabel('Название', { exact: true }).fill('Обучение');
  await page.getByRole('button', { name: 'Иконка globe' }).click();
  await page.getByRole('button', { name: 'Цвет blue' }).click();
  await page.getByRole('button', { name: 'Сохранить категорию' }).click();
  await expect(page.getByRole('heading', { name: 'Обучение', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Настройки', exact: true }).click();
  await page.getByRole('link', { name: 'Управление категориями' }).click();
  await page.getByRole('button', { name: 'Действия с категорией: Личное' }).click();
  await page.getByRole('button', { name: 'Переместить выше', exact: true }).click();
  await expect(page.locator('.category-manage .sortable-item').first()).toContainText('Личное');
  await page.reload(); await expect(page.locator('.category-manage .sortable-item').first()).toContainText('Личное');
  await page.getByRole('button', { name: 'Действия с категорией: Обучение' }).click();
  await page.getByRole('button', { name: 'Удалить категорию', exact: true }).click();
  await page.getByRole('button', { name: 'Удалить и перенести' }).click();
  await expect(page.getByRole('button', { name: 'Действия с категорией: Обучение' })).toHaveCount(0);
  await page.getByRole('navigation').getByRole('link', { name: 'Главная' }).click();
  await page.getByRole('link', { name: /Личное/ }).click();
  await expect(page.getByRole('link', { name: 'Отправить документы', exact: true })).toBeVisible();
});

test('inbox quick-add, complete, collapsed completed, restore, edit/deadline, move, delete', async ({ page }) => {
  await createCategory(page, 'Личное');
  await page.getByRole('navigation').getByRole('link', { name: 'Входящие' }).click();
  await page.getByLabel('Новая задача…', { exact: true }).fill('Написать врачу');
  await page.getByRole('button', { name: 'Добавить задачу', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Выполнить: Написать врачу' }).click();
  await expect(page.getByRole('link', { name: 'Написать врачу', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /Выполненные/ }).click();
  await page.getByRole('checkbox', { name: 'Восстановить: Написать врачу' }).click();
  await page.getByRole('link', { name: 'Написать врачу', exact: true }).click();
  await page.getByRole('button', { name: 'Редактировать задачу' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Название', { exact: true }).fill('Позвонить врачу');
  await dialog.getByText('Дополнительные параметры', { exact: true }).click();
  await dialog.getByLabel('Описание', { exact: true }).fill('Уточнить время');
  await dialog.getByLabel('Срок · необязательно').fill('2026-11-15');
  await dialog.getByLabel('Категория', { exact: true }).selectOption({ label: 'Личное' });
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Срок: 15 ноября 2026')).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading', { name: 'Позвонить врачу' })).toBeVisible();
  await page.getByRole('button', { name: 'Действия с записью' }).click();
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: 'Удалить запись', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Личное', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Позвонить врачу/ })).toHaveCount(0);
});

test('touch swipe completes task, vertical scrolling does not complete it', async ({ page }) => {
  await page.getByRole('navigation').getByRole('link', { name: 'Входящие' }).click();
  for (const title of ['Свайп', 'Прокрутка']) { await page.getByLabel('Новая задача…', { exact: true }).fill(title); await page.getByRole('button', { name: 'Добавить задачу', exact: true }).click(); }
  const swipe = page.locator('.task-row').filter({ hasText: 'Свайп' });
  await swipe.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 140, clientY: 300, bubbles: true });
  await swipe.dispatchEvent('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 240, clientY: 305, bubbles: true });
  await swipe.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 240, clientY: 305, bubbles: true });
  await expect(page.getByRole('checkbox', { name: 'Выполнить: Свайп', exact: true })).toHaveCount(0);
  const vertical = page.locator('.task-row').filter({ hasText: 'Прокрутка' });
  await vertical.dispatchEvent('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 140, clientY: 300, bubbles: true });
  await vertical.dispatchEvent('pointermove', { pointerId: 2, pointerType: 'touch', clientX: 145, clientY: 390, bubbles: true });
  await vertical.dispatchEvent('pointerup', { pointerId: 2, pointerType: 'touch', clientX: 145, clientY: 390, bubbles: true });
  await expect(page.getByRole('checkbox', { name: 'Выполнить: Прокрутка', exact: true })).toBeVisible();
});

test('projects keep completed positions, insert/reorder/persist, require manual completion, restore', async ({ page }) => {
  await createCategory(page, 'Проекты'); await page.getByRole('link', { name: /Проекты/ }).click();
  await newPlan(page, 'Проект', 'Получить права');
  await addStep(page, 'Найти автошколу'); await addStep(page, 'Сдать экзамен');
  await page.getByRole('checkbox', { name: 'Выполнить шаг: Найти автошколу' }).click();
  await expect(page.locator('.step-list .sortable-item').first()).toContainText('Найти автошколу');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  await page.getByRole('button', { name: 'Действия: Найти автошколу' }).click();
  await page.getByRole('button', { name: 'Вставить шаг после этого' }).click();
  await page.getByLabel('Название шага').fill('Пройти теорию'); await page.getByRole('button', { name: 'Сохранить шаг' }).click();
  await expect(page.locator('.step-list .step-title')).toHaveText(['Найти автошколу', 'Пройти теорию', 'Сдать экзамен']);
  await page.getByRole('button', { name: 'Действия: Сдать экзамен' }).click();
  await page.getByRole('button', { name: 'Переместить выше', exact: true }).click();
  await expect(page.locator('.step-list .step-title')).toHaveText(['Найти автошколу', 'Сдать экзамен', 'Пройти теорию']);
  await page.reload(); await expect(page.locator('.step-list .step-title')).toHaveText(['Найти автошколу', 'Сдать экзамен', 'Пройти теорию']);
  page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: 'Завершить проект', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Завершить проект', exact: true })).toBeVisible();
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Завершить проект', exact: true }).click();
  await page.getByRole('button', { name: 'Вернуть проект в активные' }).click();
  await page.getByRole('checkbox', { name: 'Восстановить шаг: Найти автошколу' }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  await page.getByRole('button', { name: 'Действия: Пройти теорию' }).click();
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Удалить шаг', exact: true }).click();
  await expect(page.locator('.step-list .step-title')).toHaveText(['Найти автошколу', 'Сдать экзамен']);
});

test('drag handle reorders steps', async ({ page }) => {
  await createCategory(page, 'Проекты'); await page.getByRole('link', { name: /Проекты/ }).click();
  await newPlan(page, 'Проект', 'Перестановка');
  await addStep(page, 'Первый'); await addStep(page, 'Второй'); await addStep(page, 'Третий');
  await page.locator('.step-list').scrollIntoViewIfNeeded();
  const source = await page.getByRole('button', { name: 'Перетащить: Первый' }).boundingBox();
  const target = await page.getByRole('button', { name: 'Перетащить: Третий' }).boundingBox();
  if (!source || !target) throw new Error('Drag handles missing');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down(); await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2 + 10, { steps: 5 });
  await expect(page.locator('.step-list .dragging')).toBeVisible();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height - 3, { steps: 15 });
  await expect(page.getByRole('status').filter({ hasText: 'Позиция 3 из 3' })).toHaveCount(1);
  await page.mouse.up();
  await expect(page.locator('.step-list .step-title')).toHaveText(['Второй', 'Третий', 'Первый']);
  await page.reload(); await expect(page.locator('.step-list .step-title')).toHaveText(['Второй', 'Третий', 'Первый']);
});

test('sessions, no duration, backdating, edit/delete, related tasks, history/statistics', async ({ page }) => {
  await createCategory(page, 'Учёба'); await page.getByRole('link', { name: /Учёба/ }).click();
  await newPlan(page, 'Регулярное направление', 'Математика');
  await addSession(page, '2026-11-07', '45'); await addSession(page, '2026-11-07');
  await expect(page.locator('.session-row')).toHaveCount(2);
  await expect(page.locator('.routine-week')).toContainText('Занятий: 2');
  await expect(page.locator('.routine-week')).toContainText('45 мин');
  await page.locator('.session-row').filter({ hasText: 'Без времени' }).click();
  await page.getByRole('dialog').getByLabel('Дата', { exact: true }).fill('2026-11-01');
  await page.getByRole('dialog').getByLabel('Продолжительность · необязательно').fill('30');
  await page.getByRole('button', { name: 'Сохранить занятие' }).click();
  await expect(page.locator('.routine-week')).toContainText('Занятий: 1');
  await expect(page.locator('.last-session')).toContainText('7 ноября 2026');
  await page.getByLabel('Добавить связанную задачу…', { exact: true }).fill('Повторить интегралы');
  await page.getByRole('button', { name: 'Добавить задачу', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Выполнить: Повторить интегралы' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'История' }).click();
  await expect(page.locator('.history-row')).toHaveCount(3);
  await page.getByRole('button', { name: 'Недельная статистика', exact: true }).click();
  await expect(page.locator('.stat').filter({ hasText: 'Задачи' }).locator('.stat-value')).toHaveText('1');
  await expect(page.locator('.stat').filter({ hasText: 'Занятия' }).locator('.stat-value')).toHaveText('1');
  await expect(page.locator('.stat').filter({ hasText: 'Известное время' }).locator('.stat-value')).toHaveText('45 мин');
  await page.getByRole('button', { name: 'Предыдущая неделя' }).click();
  await expect(page.locator('.stat').filter({ hasText: 'Известное время' }).locator('.stat-value')).toHaveText('30 мин');
  await page.locator('.history-row').filter({ hasText: '45 мин' }).click();
  await page.locator('.session-row').filter({ hasText: '45 мин' }).click();
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Удалить занятие', exact: true }).click();
  await expect(page.locator('.last-session')).toContainText('1 ноября 2026');
  await expect(page.locator('.routine-week')).toContainText('0 мин');
});

test('export/import full backup, reject malformed and unsupported files, theme persistence', async ({ page }) => {
  await demo(page); await page.getByRole('link', { name: 'Настройки', exact: true }).click();
  await page.getByRole('button', { name: 'Тёмная', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспорт данных', exact: true }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path(); if (!downloadPath) throw new Error('Backup was not downloaded');
  const backup = await readFile(downloadPath);
  expect(JSON.parse(backup.toString()).entries.length).toBe(6);
  const file = page.locator('input[type=file]');
  await file.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
  await expect(page.getByText('Не удалось прочитать JSON. Текущие данные сохранены.')).toBeVisible();
  await file.setInputFiles({ name: 'wrong-version.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...JSON.parse(backup.toString()), schemaVersion: 99 })) });
  await expect(page.getByText(/Версия резервной копии не поддерживается/)).toBeVisible();
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Начать с чистой базы' }).click();
  await expect(page.getByRole('button', { name: 'Добавить демонстрационные данные' })).toBeVisible();
  await file.setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup });
  await page.getByRole('button', { name: 'Заменить и восстановить' }).click();
  await expect(page.getByText('Данные успешно восстановлены')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('navigation').getByRole('link', { name: 'Главная' }).click();
  await expect(page.locator('.category-card')).toHaveCount(4);
});

test('draft protection, keyboard interaction, global search and long titles with no overflow', async ({ page }) => {
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  await page.getByLabel('Название', { exact: true }).fill('Не потерять');
  page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: 'Закрыть форму' }).click();
  await expect(page.getByLabel('Название', { exact: true })).toHaveValue('Не потерять');
  await page.getByRole('button', { name: 'Сохранить категорию' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Входящие' }).click();
  const title = 'Оченьдлинноеназваниебезпробелов'.repeat(6);
  await page.getByLabel('Новая задача…', { exact: true }).fill(title);
  await page.getByLabel('Новая задача…', { exact: true }).press('Enter');
  await expect(page.getByRole('checkbox', { name: `Выполнить: ${title}` })).toBeVisible();
  await page.getByLabel('Новая задача…', { exact: true }).fill('Сохранённый черновик');
  await page.getByRole('navigation').getByRole('link', { name: 'Главная' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Входящие' }).click();
  await expect(page.getByLabel('Новая задача…', { exact: true })).toHaveValue('Сохранённый черновик');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Поиск', exact: true }).click();
  await page.getByRole('searchbox').fill('Оченьдлинноеназвание');
  await expect(page.locator('.search-result')).toHaveCount(1);
  await page.locator('.search-result').click(); await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('production PWA caches app and supports offline create, complete and session save after reload', async ({ page, context }) => {
  await demo(page);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const manifest = await page.request.get('/manifest.webmanifest');
  expect((await manifest.json()).display).toBe('standalone');
  await context.setOffline(true); await page.reload();
  await expect(page.getByRole('heading', { name: 'Мои планы' })).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Входящие' }).click();
  await page.getByLabel('Новая задача…', { exact: true }).fill('Создано без интернета');
  await page.getByRole('button', { name: 'Добавить задачу', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Выполнить: Создано без интернета' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Главная' }).click();
  await page.getByRole('link', { name: /Учёба/ }).click();
  await page.getByRole('link', { name: /Математика/ }).click();
  await addSession(page, '2026-11-08', '15');
  await page.reload(); await expect(page.locator('.routine-week')).toContainText('15 мин');
  await page.getByRole('navigation').getByRole('link', { name: 'История' }).click();
  await expect(page.locator('.history-row')).toHaveCount(2);
  await context.setOffline(false);
});

test('nonempty last category offers creation of a transfer destination', async ({ page }) => {
  await createCategory(page, 'Единственная'); await page.getByRole('link', { name: /Единственная/ }).click();
  await page.getByRole('button', { name: 'Новая запись' }).click();
  await page.getByRole('dialog').getByLabel('Название', { exact: true }).fill('Сохранить задачу');
  await page.getByRole('dialog').getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Действия с категорией' }).click();
  await page.getByRole('button', { name: 'Удалить категорию', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Удалить и перенести' })).toBeDisabled();
  await page.getByRole('button', { name: 'Создать категорию для переноса', exact: false }).click();
  await page.getByRole('dialog').getByLabel('Название', { exact: true }).fill('Новая');
  await page.getByRole('button', { name: 'Сохранить категорию' }).click();
  await page.getByLabel('Перенести записи в', { exact: true }).selectOption({ label: 'Новая' });
  await page.getByRole('button', { name: 'Удалить и перенести' }).click();
  await page.getByRole('link', { name: /Новая/ }).click();
  await expect(page.getByRole('link', { name: 'Сохранить задачу', exact: true })).toBeVisible();
});

test('narrow screen, modal focus, date and duration validation and keyboard navigation', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await createCategory(page, 'Учёба'); await page.getByRole('link', { name: /Учёба/ }).click();
  await newPlan(page, 'Регулярное направление', 'Английский');
  await page.getByRole('button', { name: 'Отметить занятие', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Продолжительность · необязательно').fill('0');
  await dialog.getByRole('button', { name: 'Сохранить занятие' }).click();
  await expect(dialog).toBeVisible();
  await expect(page.locator('.session-row')).toHaveCount(0);
  await dialog.getByLabel('Продолжительность · необязательно').fill('');
  await dialog.getByRole('button', { name: '15 мин', exact: true }).click();
  await dialog.getByRole('button', { name: 'Сохранить занятие' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.routine-week')).toContainText('15 мин');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('navigation').getByRole('link', { name: 'История' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'История', exact: true })).toBeVisible();
});

test('real touch input completes inbox task in Chromium', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP touch input is Chromium-only; pointer handlers are exercised in both engines.');
  await page.getByRole('navigation').getByRole('link', { name: 'Входящие' }).click();
  await page.getByLabel('Новая задача…', { exact: true }).fill('Жест пальцем');
  await page.getByRole('button', { name: 'Добавить задачу', exact: true }).click();
  const row = page.locator('.task-row').filter({ hasText: 'Жест пальцем' });
  const box = await row.boundingBox(); if (!box) throw new Error('Task row missing');
  const cdp = await context.newCDPSession(page);
  const x = box.x + 100; const y = box.y + box.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let dx = 15; dx <= 105; dx += 15) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx, y: y + 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByRole('checkbox', { name: 'Выполнить: Жест пальцем' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Выполненные/ })).toBeVisible();
});

test('current week refreshes after overnight resume; explicitly selected historical week stays fixed', async ({ page }) => {
  await createCategory(page, 'Учёба'); await page.getByRole('link', { name: /Учёба/ }).click();
  await newPlan(page, 'Регулярное направление', 'Язык'); await addSession(page, '2026-11-08', '30');
  await page.getByRole('navigation').getByRole('link', { name: 'История' }).click();
  await page.getByRole('button', { name: 'Недельная статистика', exact: true }).click();
  const sessions = page.locator('.stat').filter({ hasText: 'Занятия' }).locator('.stat-value');
  await expect(sessions).toHaveText('1');
  await page.clock.setFixedTime(new Date('2026-11-09T10:00:00+02:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(sessions).toHaveText('0');
  await page.getByRole('button', { name: 'Предыдущая неделя' }).click();
  await expect(sessions).toHaveText('1');
  await page.clock.setFixedTime(new Date('2026-11-16T10:00:00+02:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(sessions).toHaveText('1');
});
