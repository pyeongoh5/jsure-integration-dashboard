export type DotPath<T, Leaf> = T extends Leaf
  ? ""
  : T extends object
    ? {
        [K in keyof T & string]: DotPath<T[K], Leaf> extends "" ? K : `${K}.${DotPath<T[K], Leaf>}`;
      }[keyof T & string]
    : never;

export function resolveLeaf(root: unknown, key: string): Record<string, unknown> {
  const segments = key.split(".");
  let node: unknown = root;
  for (const segment of segments) {
    if (node && typeof node === "object" && segment in node) {
      node = (node as Record<string, unknown>)[segment];
      continue;
    }
    throw new Error(`[i18n] Unknown key: ${key}`);
  }
  if (!node || typeof node !== "object") {
    throw new Error(`[i18n] Key is not a leaf: ${key}`);
  }
  return node as Record<string, unknown>;
}
