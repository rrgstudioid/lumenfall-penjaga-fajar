export const CHAT_CHANNELS = ['world', 'party', 'guild', 'system'] as const;
export type ChatChannel = (typeof CHAT_CHANNELS)[number];
export type ChatFilter = 'all' | ChatChannel;
export const CHAT_LABELS: Record<ChatFilter, string> = {
  all: 'Semua',
  world: 'Dunia',
  party: 'Party',
  guild: 'Guild',
  system: 'System',
};
export type ChatMessage = {
  id: string;
  channel: ChatChannel;
  timestamp: number;
  sender?: { id: string; name: string };
  text: string;
  local?: boolean;
};
export const CHAT_MESSAGE_LIMIT = 2000;
/** Local world messages are explicit player input, never a simulated network delivery. */
export function createLocalWorldMessage(
  text: string,
  sender: NonNullable<ChatMessage['sender']>,
  id: string,
  timestamp = Date.now(),
): ChatMessage | null {
  const content = text.trim().slice(0, CHAT_MESSAGE_LIMIT);
  if (!content) return null;
  return {
    id,
    channel: 'world',
    timestamp,
    sender,
    text: content,
    local: true,
  };
}
export type ChatConnection = 'offline' | 'connecting' | 'connected';
export interface ChatTransport {
  status: ChatConnection;
  sendableChannels: readonly ChatChannel[];
  subscribe(listener: (message: ChatMessage) => void): () => void;
  send(
    channel: ChatChannel,
    text: string,
  ): Promise<{ ok: boolean; error?: string }>;
}
export const offlineChatTransport: ChatTransport = {
  status: 'offline',
  sendableChannels: [],
  subscribe: () => () => {},
  send: async () => ({ ok: false, error: 'Chat online belum terhubung' }),
};
export type ChatState = {
  messages: ChatMessage[];
  filter: ChatFilter;
  draft: string;
  unread: Record<ChatChannel, number>;
};
export const initialChatState = (): ChatState => ({
  messages: [],
  filter: 'all',
  draft: '',
  unread: { world: 0, party: 0, guild: 0, system: 0 },
});
export type ChatAction =
  | { type: 'receive'; message: ChatMessage; reading: boolean }
  | { type: 'filter'; filter: ChatFilter }
  | { type: 'read' }
  | { type: 'draft'; text: string };
export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  if (action.type === 'draft') return { ...state, draft: action.text };
  if (action.type === 'filter') return { ...state, filter: action.filter };
  if (action.type === 'read')
    return {
      ...state,
      unread: {
        ...state.unread,
        ...Object.fromEntries(
          CHAT_CHANNELS.filter(
            (channel) => state.filter === 'all' || state.filter === channel,
          ).map((channel) => [channel, 0]),
        ),
      },
    };
  if (state.messages.some((message) => message.id === action.message.id))
    return state;
  const channel = action.message.channel,
    visible = state.filter === 'all' || state.filter === channel;
  return {
    ...state,
    messages: [...state.messages, action.message].slice(-300),
    unread: {
      ...state.unread,
      [channel]: state.unread[channel] + (visible && action.reading ? 0 : 1),
    },
  };
}
