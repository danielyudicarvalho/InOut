export type CatalogItem = {
  id: string;
  name: string;
  archivedAt: string | null;
};
export type CatalogCategory = CatalogItem & {
  flow: "income" | "expense";
  parentId: string | null;
};
export type CatalogType = "categories" | "sources";
export type CatalogBody = {
  name: string;
  flow?: "income" | "expense";
  parentId?: string | null;
};
export type CatalogPending = {
  key: string;
  type: CatalogType;
  body: CatalogBody;
};
export type CatalogData = {
  currencies: string[];
  categories: CatalogCategory[];
  sources: CatalogItem[];
};
export function categoryParentChoices(
  categories: CatalogCategory[],
  flow: string,
): CatalogCategory[];
export function canArchiveCategory(
  categories: CatalogCategory[],
  id: string,
): boolean;
export function createCatalogRepository(options: {
  baseUrl?: string;
  getToken: () => Promise<string | null>;
  fetcher?: typeof fetch;
}): {
  list: (household: string, signal?: AbortSignal) => Promise<CatalogData>;
  create: (
    household: string,
    pending: CatalogPending,
  ) => Promise<{ id: string; name: string }>;
  archive: (household: string, type: CatalogType, id: string) => Promise<void>;
};
export function createCatalogStore(
  repository: ReturnType<typeof createCatalogRepository>,
  household: string,
  options: {
    randomId: () => string;
    storage: {
      load: () => Promise<string | null>;
      save: (value: string) => Promise<void>;
      remove: (key: string) => Promise<void>;
    };
  },
): {
  getSnapshot: () => CatalogData & {
    loading: boolean;
    busy: boolean;
    error: string;
    notice: string;
    pending: CatalogPending | null;
  };
  subscribe: (fn: () => void) => () => void;
  start: () => () => void;
  retry: () => void;
  create: (type: CatalogType, body: CatalogBody) => Promise<boolean>;
  archive: (type: CatalogType, id: string) => Promise<boolean>;
  recover: () => Promise<boolean>;
};
