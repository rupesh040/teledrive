// Holds the item being dragged (file/folder) during a drag-and-drop operation.
// Uses a module variable rather than dataTransfer for reliable cross-browser
// internal drags between elements on the same page.
export type DragItem = { kind: 'file' | 'folder'; id: number };

let current: DragItem | null = null;

export const dnd = {
  set: (d: DragItem | null) => { current = d; },
  get: () => current,
};
