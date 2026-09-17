export type Participant = {
  readonly userId: string;
  readonly nickname: string;
  readonly virtual: boolean;
  readonly joinedAt: number;
};

export type ChatEvent = {
  readonly type: string;
  readonly userId: string;
  readonly nickname: string;
  readonly text: string;
  readonly at: number;
};

export type ChatState = {
  readonly capacity: number;
  readonly memberCount: number;
  readonly queueCount: number;
  readonly members: readonly Participant[];
  readonly queue: readonly Participant[];
  readonly events: readonly ChatEvent[];
};

export type SocketPayload = {
  readonly type: string;
  readonly state: ChatState | null;
  readonly message: string;
};

export const EMPTY_STATE: ChatState = {
  capacity: 3,
  memberCount: 0,
  queueCount: 0,
  members: [],
  queue: [],
  events: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(value: Record<string, unknown>, key: string): string | null {
  const found = value[key];
  return typeof found === 'string' ? found : null;
}

function numberField(value: Record<string, unknown>, key: string): number | null {
  const found = value[key];
  return typeof found === 'number' ? found : null;
}

function parseParticipant(value: unknown): Participant | null {
  if (!isRecord(value)) return null;
  const userId = stringField(value, 'userId');
  const nickname = stringField(value, 'nickname');
  const joinedAt = numberField(value, 'joinedAt');
  if (!userId || !nickname || typeof value.virtual !== 'boolean' || joinedAt === null) return null;
  return { userId, nickname, virtual: value.virtual, joinedAt };
}

function parseEvent(value: unknown): ChatEvent | null {
  if (!isRecord(value)) return null;
  const type = stringField(value, 'type');
  const userId = stringField(value, 'userId');
  const nickname = stringField(value, 'nickname');
  const text = stringField(value, 'text');
  const at = numberField(value, 'at');
  if (!type || !userId || !nickname || text === null || at === null) return null;
  return { type, userId, nickname, text, at };
}

export function parseState(value: unknown): ChatState | null {
  if (!isRecord(value)) return null;
  const capacity = numberField(value, 'capacity');
  const memberCount = numberField(value, 'memberCount');
  const queueCount = numberField(value, 'queueCount');
  if (capacity === null || memberCount === null || queueCount === null) return null;
  const members = Array.isArray(value.members)
    ? value.members.map(parseParticipant).filter((item): item is Participant => item !== null)
    : [];
  const queue = Array.isArray(value.queue)
    ? value.queue.map(parseParticipant).filter((item): item is Participant => item !== null)
    : [];
  const events = Array.isArray(value.events)
    ? value.events.map(parseEvent).filter((item): item is ChatEvent => item !== null)
    : [];
  return { capacity, memberCount, queueCount, members, queue, events };
}

export function parsePayload(value: unknown): SocketPayload | null {
  if (!isRecord(value)) return null;
  const type = stringField(value, 'type');
  if (!type) return null;
  const state = parseState(value.state);
  return { type, state, message: stringField(value, 'message') ?? '' };
}
