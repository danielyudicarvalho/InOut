export type ManagedAccount = {
  id: string;
  name: string;
  kind: string;
  currency: string;
  balance: number;
  archivedAt: string | null;
};
export function groupAccounts(
  accounts: ManagedAccount[],
  options?: { archived?: boolean; search?: string },
): { currency: string; balance: number; accounts: ManagedAccount[] }[];
export function createAccountsRepository(options: {
  baseUrl?: string;
  getToken: () => Promise<string | null>;
  fetcher?: typeof fetch;
}): {
  list: (household: string, signal?: AbortSignal) => Promise<ManagedAccount[]>;
  edit: (
    household: string,
    id: string,
    name: string,
    kind: string,
  ) => Promise<void>;
  archive: (household: string, id: string) => Promise<void>;
};
