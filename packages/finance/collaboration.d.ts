export type HouseholdRole = "owner" | "member";
export type HouseholdMember = {
  userId: string;
  role: HouseholdRole;
  joinedAt: string;
};
export type HouseholdContext = {
  id: string;
  name: string;
  actorId: string;
  role: HouseholdRole;
  maximumMembers: number;
  members: HouseholdMember[];
};
export type InvitationSummary = {
  id: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};
export type InvitationCode = { code: string; expiresAt: string };
export class CollaborationFailure extends Error {
  code: string;
  constructor(code: string);
}
export function collaborationMessage(error: unknown): string;
export function roleLabel(role: string): string;
export function memberLabel(member: HouseholdMember, actorId: string): string;
export function invitationStatus(item: InvitationSummary, now?: number): string;
export function lastOwner(
  context: HouseholdContext,
  member: HouseholdMember,
): boolean;
export function createCollaborationRepository(options: {
  baseUrl?: string;
  getToken: () => Promise<string | null>;
  fetcher?: typeof fetch;
}): {
  homes: (signal?: AbortSignal) => Promise<{ id: string; name: string }[]>;
  context: (
    household: string,
    signal?: AbortSignal,
  ) => Promise<HouseholdContext>;
  invitations: (
    household: string,
    signal?: AbortSignal,
  ) => Promise<InvitationSummary[]>;
  invite: (household: string) => Promise<InvitationCode>;
  changeRole: (
    household: string,
    member: string,
    role: HouseholdRole,
  ) => Promise<null>;
  remove: (household: string, member: string) => Promise<null>;
  leave: (household: string) => Promise<null>;
  revoke: (household: string, id: string) => Promise<null>;
  accept: (code: string) => Promise<{ id: string; name: string }>;
};
export function createCollaborationStore(
  repository: ReturnType<typeof createCollaborationRepository>,
  initialHousehold?: string,
): {
  getSnapshot: () => {
    homes: { id: string; name: string }[];
    household: string;
    context: HouseholdContext | null;
    invitations: InvitationSummary[];
    code: InvitationCode | null;
    loading: boolean;
    busy: boolean;
    status: string;
    notice: string;
  };
  subscribe: (fn: () => void) => () => void;
  start: () => () => void;
  retry: () => void;
  select: (id: string) => void;
  invite: () => Promise<boolean>;
  role: (id: string, role: HouseholdRole) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  leave: () => Promise<boolean>;
  revoke: (id: string) => Promise<boolean>;
  clearCode: () => void;
};
export function createHouseholdAccessStore(
  repository: Pick<ReturnType<typeof createCollaborationRepository>, "homes">,
  household?: string,
): {
  getSnapshot: () => { status: string; notice: string };
  subscribe: (fn: () => void) => () => void;
  start: () => () => void;
  retry: () => void;
};
