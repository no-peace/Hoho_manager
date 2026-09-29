import type { ComponentNode } from "@dmb/shared";

/**
 * Immutable tree operations over an array of components.
 *
 * Components nest (a Container holds children, an ActionRow holds buttons), so
 * every edit needs a recursive walk. These helpers always return **new** arrays
 * and report whether anything matched, which lets the store skip state writes
 * (and therefore re-renders) for no-op updates.
 *
 * Only `components` arrays are traversed; `items`/`options` are leaves.
 */

export interface TreeResult {
  components: ComponentNode[];
  found: boolean;
}

/** Depth-first search for a component by `_id`. */
export const findComponent = (
  components: ComponentNode[] | undefined,
  id: string,
): ComponentNode | null => {
  for (const component of components ?? []) {
    if (component._id === id) return component;
    if (Array.isArray(component.components)) {
      const nested = findComponent(component.components, id);
      if (nested) return nested;
    }
  }
  return null;
};

/** Replace a component in place via `updater`. */
export const updateComponent = (
  components: ComponentNode[] | undefined,
  id: string,
  updater: (component: ComponentNode) => Partial<ComponentNode>,
): TreeResult => {
  let found = false;

  const next = (components ?? []).map((component) => {
    if (component._id === id) {
      found = true;
      return { ...component, ...updater(component) };
    }
    if (Array.isArray(component.components)) {
      const result = updateComponent(component.components, id, updater);
      if (result.found) {
        found = true;
        return { ...component, components: result.components };
      }
    }
    return component;
  });

  return { components: found ? next : (components ?? []), found };
};

/** Remove a component by id, wherever it sits. */
export const removeComponent = (
  components: ComponentNode[] | undefined,
  id: string,
): TreeResult => {
  let found = false;
  const next: ComponentNode[] = [];

  for (const component of components ?? []) {
    if (component._id === id) {
      found = true;
      continue;
    }
    if (Array.isArray(component.components)) {
      const result = removeComponent(component.components, id);
      if (result.found) {
        found = true;
        next.push({ ...component, components: result.components });
        continue;
      }
    }
    next.push(component);
  }

  return { components: found ? next : (components ?? []), found };
};

/**
 * Append `item` to a parent's children, or to the top level when `parentId` is
 * null/unknown.
 */
export const insertComponent = (
  components: ComponentNode[] | undefined,
  parentId: string | null,
  item: ComponentNode,
): TreeResult => {
  if (!parentId) return { components: [...(components ?? []), item], found: true };

  const result = updateComponent(components, parentId, (parent) => ({
    components: [...(parent.components ?? []), item],
  }));

  // Unknown parent: fall back to the top level rather than silently dropping it.
  if (!result.found) return { components: [...(components ?? []), item], found: true };
  return result;
};

/** Move a component one slot earlier/later among its own siblings. */
export const moveComponent = (
  components: ComponentNode[] | undefined,
  id: string,
  direction: number,
  parentId: string | null = null,
): TreeResult => {
  const list = parentId ? findComponent(components, parentId)?.components : components;
  if (!list) return { components: components ?? [], found: false };

  const index = list.findIndex((component) => component._id === id);
  if (index === -1) return { components: components ?? [], found: false };

  const target = index + direction;
  if (target < 0 || target >= list.length) return { components: components ?? [], found: false };

  const reordered = [...list];
  const current = reordered[index];
  const swap = reordered[target];
  if (!current || !swap) return { components: components ?? [], found: false };
  reordered[index] = swap;
  reordered[target] = current;

  if (!parentId) return { components: reordered, found: true };
  return updateComponent(components, parentId, () => ({ components: reordered }));
};
