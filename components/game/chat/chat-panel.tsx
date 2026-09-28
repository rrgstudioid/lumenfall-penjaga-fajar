'use client';
import {
  memo,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { ArrowDown, Send } from 'lucide-react';
import {
  chatReducer,
  initialChatState,
  CHAT_LABELS,
  offlineChatTransport,
  createLocalWorldMessage,
  CHAT_MESSAGE_LIMIT,
  type ChatFilter,
  type ChatTransport,
  type ChatMessage,
} from '@/lib/game/chat';

function ChatTabs({
  filter,
  unread,
  onChange,
}: {
  filter: ChatFilter;
  unread: ReturnType<typeof initialChatState>['unread'];
  onChange: (filter: ChatFilter) => void;
}) {
  return (
    <div className="hud-chat-tabs" role="tablist" aria-label="Channel chat">
      {(Object.keys(CHAT_LABELS) as ChatFilter[]).map((channel) => {
        const count =
          channel === 'all'
            ? Object.values(unread).reduce((a, b) => a + b, 0)
            : unread[channel];
        return (
          <button
            key={channel}
            id={`chat-tab-${channel}`}
            role="tab"
            aria-selected={channel === filter}
            aria-controls="chat-history"
            tabIndex={channel === filter ? 0 : -1}
            onClick={() => onChange(channel)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
              event.preventDefault();
              const channels = Object.keys(CHAT_LABELS) as ChatFilter[];
              const next =
                channels[
                  (channels.indexOf(channel) +
                    (event.key === 'ArrowRight' ? 1 : 4)) %
                    channels.length
                ];
              onChange(next);
              document.getElementById(`chat-tab-${next}`)?.focus();
            }}
          >
            {CHAT_LABELS[channel]}
            {count > 0 && (
              <small aria-label={`${count} belum dibaca`}>
                {count > 99 ? '99+' : count}
              </small>
            )}
          </button>
        );
      })}
    </div>
  );
}
const ChatMessageRow = memo(function ChatMessageRow({
  message,
}: {
  message: ChatMessage;
}) {
  const time = new Date(message.timestamp).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return (
    <div className={`hud-chat-message channel-${message.channel}`}>
      <time dateTime={new Date(message.timestamp).toISOString()}>[{time}]</time>{' '}
      <span className="hud-chat-channel">[{CHAT_LABELS[message.channel]}]</span>{' '}
      {message.local && <small className="hud-chat-local">[Lokal]</small>}{' '}
      {message.sender && <strong>{message.sender.name}: </strong>}
      <span>{message.text}</span>
    </div>
  );
});
export const ChatPanel = memo(function ChatPanel({
  inputRef,
  onFocusChange,
  available,
  mapId,
  mapName,
  notice,
  noticeId,
  sessionId,
  characterName,
  onLocalMessage,
  transport = offlineChatTransport,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  onFocusChange: (focus: boolean) => void;
  available: boolean;
  mapId: string;
  mapName: string;
  notice: string;
  noticeId: number;
  sessionId: string;
  characterName: string;
  onLocalMessage: (message: ChatMessage) => boolean;
  transport?: ChatTransport;
}) {
  const [state, dispatch] = useReducer(
    chatReducer,
    undefined,
    initialChatState,
  );
  const [sendError, setSendError] = useState('');
  const composing = useRef(false);
  const history = useRef<HTMLDivElement>(null),
    atBottom = useRef(true),
    active = useRef(false),
    sequence = useRef(0);
  const location = useRef(''),
    lastNotice = useRef('');
  const anchor = useRef<{ id?: string; offset: number }>({ offset: 0 });
  const rememberAnchor = () => {
    const el = history.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    const row = Array.from(
      el.querySelectorAll<HTMLElement>('[data-message-id]'),
    ).find((node) => node.getBoundingClientRect().bottom > top);
    anchor.current = {
      id: row?.dataset.messageId,
      offset: row ? row.getBoundingClientRect().top - top : 0,
    };
  };
  useEffect(() => {
    active.current = available;
    if (!available) {
      inputRef.current?.blur();
      onFocusChange(false);
    }
  }, [available, inputRef, onFocusChange]);
  useEffect(
    () =>
      transport.subscribe((message) =>
        dispatch({
          type: 'receive',
          message,
          reading: active.current && atBottom.current,
        }),
      ),
    [transport],
  );
  useEffect(() => {
    if (!available) return;
    const identity = `${sessionId}:${mapId}`;
    if (location.current === identity) return;
    location.current = identity;
    dispatch({
      type: 'receive',
      reading: atBottom.current,
      message: {
        id: `location:${++sequence.current}`,
        channel: 'system',
        timestamp: Date.now(),
        text: `Selamat datang di ${mapName}!`,
      },
    });
  }, [available, mapId, mapName, sessionId]);
  useEffect(() => {
    if (!available || !notice) return;
    const identity = `${sessionId}:${noticeId}`;
    if (lastNotice.current === identity) return;
    lastNotice.current = identity;
    dispatch({
      type: 'receive',
      reading: atBottom.current,
      message: {
        id: `notice:${identity}`,
        channel: 'system',
        timestamp: Date.now(),
        text: notice,
      },
    });
  }, [available, notice, noticeId, sessionId]);
  useLayoutEffect(() => {
    const el = history.current;
    if (!el) return;
    if (atBottom.current) el.scrollTop = el.scrollHeight;
    else {
      const row = Array.from(
        el.querySelectorAll<HTMLElement>('[data-message-id]'),
      ).find((node) => node.dataset.messageId === anchor.current.id);
      if (row)
        el.scrollTop +=
          row.getBoundingClientRect().top -
          el.getBoundingClientRect().top -
          anchor.current.offset;
    }
  }, [state.messages, state.filter]);
  const messages = state.messages.filter(
    (message) => state.filter === 'all' || state.filter === message.channel,
  );
  const unread =
    state.filter === 'all'
      ? Object.values(state.unread).reduce((a, b) => a + b, 0)
      : state.unread[state.filter];
  const readBottom = () => {
    atBottom.current = true;
    if (history.current)
      history.current.scrollTop = history.current.scrollHeight;
    dispatch({ type: 'read' });
  };
  const sendLocal = () => {
    if (!available || composing.current) return;
    const message = createLocalWorldMessage(
      state.draft,
      { id: sessionId, name: characterName },
      `local:${sessionId}:${++sequence.current}`,
    );
    if (!message) return;
    if (!onLocalMessage(message)) {
      setSendError('Dunia belum siap. Pesan belum dikirim.');
      return;
    }
    setSendError('');
    // The composer always addresses Dunia; other tabs remain history filters.
    if (state.filter !== 'all' && state.filter !== 'world') {
      atBottom.current = true;
      dispatch({ type: 'filter', filter: 'world' });
      dispatch({ type: 'read' });
    }
    dispatch({ type: 'receive', message, reading: atBottom.current });
    dispatch({ type: 'draft', text: '' });
    inputRef.current?.blur();
  };
  return (
    <section className="hud-chat hud-panel" aria-label="Chat">
      <ChatTabs
        filter={state.filter}
        unread={state.unread}
        onChange={(filter) => {
          atBottom.current = true;
          dispatch({ type: 'filter', filter });
          dispatch({ type: 'read' });
        }}
      />
      <div
        ref={history}
        id="chat-history"
        role="tabpanel"
        aria-labelledby={`chat-tab-${state.filter}`}
        className="hud-chat-history"
        tabIndex={0}
        onScroll={() => {
          const el = history.current;
          if (!el) return;
          atBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight <= 24;
          rememberAnchor();
          if (atBottom.current && unread) dispatch({ type: 'read' });
        }}
        onWheel={(event) => event.stopPropagation()}
      >
        {messages.length ? (
          messages.map((message) => (
            <div key={message.id} data-message-id={message.id}>
              <ChatMessageRow message={message} />
            </div>
          ))
        ) : (
          <p className="hud-chat-empty">
            {state.filter === 'system'
              ? 'Belum ada pesan System.'
              : 'Belum ada pesan. Chat online belum terhubung.'}
          </p>
        )}
      </div>
      {unread > 0 && (
        <button className="hud-chat-unread" onClick={readBottom}>
          <ArrowDown size={12} />
          {unread} pesan baru
        </button>
      )}
      <form
        className="hud-chat-compose"
        onSubmit={(event) => {
          event.preventDefault();
          sendLocal();
        }}
      >
        <input
          ref={inputRef}
          aria-label="Pesan chat"
          placeholder="Pesan ke Dunia (lokal)…"
          value={state.draft}
          maxLength={CHAT_MESSAGE_LIMIT}
          disabled={!available}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
          }}
          onChange={(event) =>
            dispatch({ type: 'draft', text: event.target.value })
          }
          onFocus={() => onFocusChange(true)}
          onBlur={() => onFocusChange(false)}
          onKeyDown={(event) => {
            if (
              event.nativeEvent.isComposing ||
              composing.current ||
              // oxlint-disable-next-line typescript/no-deprecated -- Safari IME confirmation may end composition before this keydown.
              event.keyCode === 229
            )
              return;
            if (event.key === 'Enter') {
              event.preventDefault();
              event.stopPropagation();
              if (!event.repeat) {
                if (!state.draft.trim()) event.currentTarget.blur();
                else sendLocal();
              }
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.blur();
            }
          }}
        />
        <button
          type="submit"
          disabled={!available || !state.draft.trim()}
          title="Kirim ke Dunia lokal"
          aria-label="Kirim pesan ke Dunia lokal"
        >
          <Send size={19} />
        </button>
      </form>
      <small className="hud-chat-offline">
        {sendError || 'Dunia lokal · pesan hanya terlihat di perangkat ini'}
      </small>
    </section>
  );
});
