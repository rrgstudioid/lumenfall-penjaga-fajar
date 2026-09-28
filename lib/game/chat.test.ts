import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chatReducer,
  initialChatState,
  offlineChatTransport,
  createLocalWorldMessage,
  CHAT_MESSAGE_LIMIT,
  type ChatMessage,
} from './chat.ts';
const message = (
  id: string,
  channel: ChatMessage['channel'] = 'system',
): ChatMessage => ({ id, channel, timestamp: 1000, text: 'Pesan lokal' });
void test('chat deduplicates event IDs and keeps at most 300 messages', () => {
  let state = initialChatState();
  for (let i = 0; i < 350; i++)
    state = chatReducer(state, {
      type: 'receive',
      message: message(String(i)),
      reading: true,
    });
  assert.equal(state.messages.length, 300);
  assert.equal(state.messages[0].id, '50');
  assert.equal(
    chatReducer(state, {
      type: 'receive',
      message: message('349'),
      reading: false,
    }),
    state,
  );
});
void test('unread distinguishes hidden channels and preserves unread when switching filters', () => {
  let state = chatReducer(initialChatState(), {
    type: 'filter',
    filter: 'world',
  });
  state = chatReducer(state, {
    type: 'receive',
    message: message('1'),
    reading: true,
  });
  state = chatReducer(state, {
    type: 'receive',
    message: message('2', 'world'),
    reading: false,
  });
  assert.deepEqual(state.unread, { world: 1, party: 0, guild: 0, system: 1 });
  state = chatReducer(state, { type: 'read' });
  assert.equal(state.unread.world, 0);
  assert.equal(state.unread.system, 1);
  state = chatReducer(state, { type: 'filter', filter: 'system' });
  assert.equal(state.unread.system, 1);
  state = chatReducer(state, { type: 'read' });
  assert.equal(state.unread.system, 0);
});
void test('offline transport does not fabricate sent messages or clear drafts', async () => {
  const state = chatReducer(initialChatState(), {
    type: 'draft',
    text: 'wasd 123 qe',
  });
  assert.equal(offlineChatTransport.status, 'offline');
  assert.deepEqual(offlineChatTransport.sendableChannels, []);
  assert.equal(
    (await offlineChatTransport.send('world', state.draft)).ok,
    false,
  );
  assert.equal(state.draft, 'wasd 123 qe');
  assert.equal(state.messages.length, 0);
});
void test('explicit offline player messages enter world history with local delivery and real sender', () => {
  const sender = { id: 'character-1', name: 'Penjaga Fajar' };
  const local = createLocalWorldMessage(
    '  Halo dunia 👋 <b>teks</b>  ',
    sender,
    'local:1',
    123,
  );
  assert.deepEqual(local, {
    id: 'local:1',
    channel: 'world',
    timestamp: 123,
    sender,
    text: 'Halo dunia 👋 <b>teks</b>',
    local: true,
  });
  const state = chatReducer(initialChatState(), {
    type: 'receive',
    message: local!,
    reading: true,
  });
  assert.equal(state.messages[0], local);
  assert.equal(state.unread.world, 0);
  assert.equal(createLocalWorldMessage('   ', sender, 'empty'), null);
  assert.equal(
    createLocalWorldMessage('a'.repeat(2500), sender, 'long')?.text.length,
    CHAT_MESSAGE_LIMIT,
  );
});
