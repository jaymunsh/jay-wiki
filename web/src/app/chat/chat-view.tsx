'use client';

import { formatKoreanTime } from '@/lib/dateTime';
import type { ChatEvent, ChatState, Participant } from './chat-contract';

type ChatRoomProps = {
  readonly state: ChatState;
  readonly connected: boolean;
  readonly nickname: string;
  readonly message: string;
  readonly notice: string;
  readonly currentUserId: string;
  readonly currentStatus: string;
  readonly onNicknameChange: (value: string) => void;
  readonly onMessageChange: (value: string) => void;
  readonly onConnect: () => void;
  readonly onLeave: () => void;
  readonly onSendMessage: () => void;
  readonly onSimulate: (path: string, count: number) => void;
  readonly onReset: () => void;
};

type ChatToolsProps = {
  readonly state: ChatState;
  readonly currentStatus: string;
  readonly onSimulate: (path: string, count: number) => void;
  readonly onReset: () => void;
};

export function ChatRoom({
  state,
  connected,
  nickname,
  message,
  notice,
  currentUserId,
  currentStatus,
  onNicknameChange,
  onMessageChange,
  onConnect,
  onLeave,
  onSendMessage,
  onSimulate,
  onReset,
}: ChatRoomProps) {
  return (
    <section className="chat-shell">
      <div className="chat-room">
        <div className="chat-room-head">
          <div>
            <div className="eyebrow">WebSocket room</div>
            <h2>random-main</h2>
          </div>
          <div className={`chat-status ${connected ? 'online' : 'idle'}`}>{currentStatus}</div>
        </div>

        <ChatThread events={state.events} currentUserId={currentUserId} />

        <div className="chat-composer">
          <div className="chat-connect-row">
            <label>
              <span>닉네임</span>
              <input value={nickname} onChange={(event) => onNicknameChange(event.target.value)} />
            </label>
            <button className="btn btn-primary" onClick={onConnect} type="button">연결</button>
            <button className="btn" onClick={onLeave} type="button">퇴장</button>
          </div>
          <div className="chat-compose-row">
            <input
              aria-label="채팅 메시지"
              value={message}
              onChange={(event) => onMessageChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
                event.preventDefault();
                onSendMessage();
              }}
            />
            <button className="btn" onClick={onSendMessage} type="button">전송</button>
          </div>
          <p>{notice}</p>
        </div>
      </div>

      <ChatTools state={state} currentStatus={currentStatus} onSimulate={onSimulate} onReset={onReset} />
    </section>
  );
}

function ChatTools({ state, currentStatus, onSimulate, onReset }: ChatToolsProps) {
  return (
    <aside className="chat-side" aria-label="채팅 상태">
      <div className="chat-side-section">
        <h3>Room status</h3>
        <div className="chat-mini-metrics">
          <span>입장</span>
          <strong>{state.memberCount}/{state.capacity}</strong>
          <span>대기</span>
          <strong>{state.queueCount}</strong>
          <span>내 상태</span>
          <strong>{currentStatus}</strong>
        </div>
      </div>

      <div className="chat-side-section">
        <h3>Demo controls</h3>
        <div className="chat-demo-actions">
          <button className="btn" onClick={() => onSimulate('/api/bff/chat/simulate/join', 1)} type="button">+1</button>
          <button className="btn" onClick={() => onSimulate('/api/bff/chat/simulate/join', 5)} type="button">+5</button>
          <button className="btn" onClick={() => onSimulate('/api/bff/chat/simulate/leave', 1)} type="button">-1</button>
          <button className="btn" onClick={onReset} type="button">초기화</button>
        </div>
      </div>

      <ChatList title="입장 중" items={state.members} />
      <ChatList title="대기열" items={state.queue} />
    </aside>
  );
}

export function ChatDebug({ state }: { readonly state: ChatState }) {
  return (
    <details className="chat-debug">
      <summary>Redis debug view</summary>
      <div className="chat-debug-grid">
        <ChatList title="SET members" items={state.members} />
        <ChatList title="ZSET queue" items={state.queue} />
        <div className="chat-event-log">
          <h3>EVENT stream</h3>
          {state.events.length === 0 && <div className="saga-empty">아직 이벤트가 없습니다.</div>}
          {state.events.map((event) => (
            <div className="chat-event" key={`${event.at}-${event.type}-${event.userId}`}>
              <span>{event.type}</span>
              <strong>{event.nickname}</strong>
              <em>{event.text || formatTime(event.at)}</em>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function ChatThread({ events, currentUserId }: { readonly events: readonly ChatEvent[]; readonly currentUserId: string }) {
  return (
    <div className="chat-thread" aria-live="polite">
      {events.length === 0 && (
        <div className="chat-empty">
          <strong>아직 메시지가 없습니다.</strong>
          <span>접속 이벤트와 대기열 승격 로그가 이 창에 함께 표시됩니다.</span>
        </div>
      )}
      {events.map((event) => (
        <ChatThreadEvent event={event} mine={event.userId === currentUserId} key={`${event.at}-${event.type}-${event.userId}`} />
      ))}
    </div>
  );
}

function ChatThreadEvent({ event, mine }: { readonly event: ChatEvent; readonly mine: boolean }) {
  if (event.type !== 'MESSAGE') {
    return (
      <div className="chat-system-line">
        <span>{systemText(event)}</span>
        <time>{formatTime(event.at)}</time>
      </div>
    );
  }

  return (
    <div className={`chat-bubble-row ${mine ? 'mine' : ''}`}>
      <div className="chat-bubble">
        <div>
          <strong>{event.nickname}</strong>
          <time>{formatTime(event.at)}</time>
        </div>
        <p>{event.text}</p>
      </div>
    </div>
  );
}

function ChatList({ title, items }: { readonly title: string; readonly items: readonly Participant[] }) {
  return (
    <div className="chat-list">
      <h3>{title}</h3>
      {items.length === 0 && <div className="saga-empty">비어 있음</div>}
      {items.map((item, index) => (
        <div className="chat-person" key={item.userId}>
          <span>{index + 1}</span>
          <strong>{item.nickname}</strong>
          <em>{item.virtual ? 'virtual' : 'real'}</em>
        </div>
      ))}
    </div>
  );
}

function systemText(event: ChatEvent): string {
  if (event.text.length > 0) return event.text;
  if (event.type === 'ENTERED') return `${event.nickname} 입장`;
  if (event.type === 'WAITING') return `${event.nickname} 대기열 진입`;
  if (event.type === 'PROMOTED') return `${event.nickname} 입장 승격`;
  if (event.type === 'LEFT') return `${event.nickname} 퇴장`;
  return event.type;
}

function formatTime(value: number): string {
  return formatKoreanTime(value);
}
