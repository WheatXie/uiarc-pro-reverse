import raw from "../data/catalog.json";

export interface CatalogItem {
  slug: string;
  title: string;
  description: string;
  categories: string[];
  dependencies: string[];
  pro: boolean;
}

export interface CatalogGroup {
  title: string;
  items: CatalogItem[];
}

interface RawCatalog {
  docs: { slug: string; title: string }[];
  components: CatalogGroup[];
  blocks: CatalogGroup[];
  special: CatalogGroup[];
}

const catalog = raw as RawCatalog;

export const docs = catalog.docs;
/** Only the gated items are reconstructed: the free registry is not part of this clone. */
const keepPro = (groups: CatalogGroup[]): CatalogGroup[] =>
  groups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.pro) }))
    .filter((group) => group.items.length > 0);

export const componentGroups = keepPro(catalog.components);
export const blockGroups = keepPro(catalog.blocks);
/** "Special components" is the reference's fourth sidebar section: effects, docks, illustrations. */
export const specialGroups = keepPro(catalog.special ?? []);

export const components = [...componentGroups, ...specialGroups].flatMap((group) => group.items);
export const blocks = blockGroups.flatMap((group) => group.items);

export const proComponents = components.filter((item) => item.pro);
export const proBlocks = blocks.filter((item) => item.pro);

export function findComponent(slug: string) {
  return components.find((item) => item.slug === slug);
}

export function findBlock(slug: string) {
  return blocks.find((item) => item.slug === slug);
}

export function groupOf(slug: string, kind: "component" | "block") {
  const groups = kind === "component" ? [...componentGroups, ...specialGroups] : blockGroups;
  return groups.find((group) => group.items.some((item) => item.slug === slug))?.title ?? "";
}
