import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

function filePath(filename: string): string {
  return path.join(DATA_DIR, filename.endsWith('.json') ? filename : `${filename}.json`);
}

export function readStore<T>(filename: string): T[] {
  const fp = filePath(filename);
  if (!fs.existsSync(fp)) return [];
  const raw = fs.readFileSync(fp, 'utf-8');
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

export function writeStore<T>(filename: string, data: T[]): void {
  const fp = filePath(filename);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
}

export function addItem<T>(filename: string, item: T): T[] {
  const items = readStore<T>(filename);
  items.push(item);
  writeStore(filename, items);
  return items;
}

export function updateItem<T extends { id: string }>(
  filename: string,
  id: string,
  updates: Partial<T>,
): T[] {
  const items = readStore<T>(filename);
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return items;
  items[idx] = { ...items[idx], ...updates };
  writeStore(filename, items);
  return items;
}
