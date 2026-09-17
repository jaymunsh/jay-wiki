'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { ScenarioCaseBanner } from '@/app/scenarios/ScenarioCaseBanner';
import type { ChatState } from './chat-contract';
import { EMPTY_STATE, parsePayload, parseState } from './chat-contract';
import { ChatDebug, ChatRoom } from './chat-view';

function browserId(): string {
  const key = 'jaywiki-chat-user-id';
  const saved = window.localStorage.getItem(key);
  if (saved) return saved;
  const next = window.crypto.randomUUID();
  window.localStorage.setItem(key, next);
  return next;
}

function socketUrl(userId: string, nickname: string): string {
  const configured = process.env.NEXT_PUBLIC_WS_BASE;
  const base = configured && configured.length > 0
    ? configured
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
  const params = new URLSearchParams({ userId, nickname });
  return `${base}/ws/chat?${params.toString()}`;
}

async function postCount(path: string, count: number): Promise<ChatState | null> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ count }),
  });
  if (!response.ok) return null;
  return parseState(await response.json());
}

export default function ChatPage() {
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const [state, setState] = useState<ChatState>(EMPTY_STATE);
  const [connected, setConnected] = useState(false);
  const [nickname, setNickname] = useState('guest');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('대기열 시뮬레이터 준비');

  // useMemo 였는데 의존성이 [connected, state] 였다. 저장소 읽기는 그 둘과 무관하고,
  // 접속 뒤 값이 생기는 것을 다시 읽으려고 붙여 둔 것이라 메모가 아니라 트리거로 쓰이고 있었다.
  // 매 렌더 읽어도 값이 같고 비용도 없다.
  const currentUserId =
    typeof window === 'undefined' ? '' : window.localStorage.getItem('jaywiki-chat-user-id') ?? '';

  const currentStatus = useMemo(() => {
    if (state.members.some((item) => item.userId === currentUserId)) return '입장';
    const queueIndex = state.queue.findIndex((item) => item.userId === currentUserId);
    return queueIndex >= 0 ? `대기 ${queueIndex + 1}번` : '미접속';
  }, [currentUserId, state]);

  async function refreshState() {
    const response = await fetch('/api/bff/chat/state', { cache: 'no-store' });
    if (!response.ok) return;
    const next = parseState(await response.json());
    if (next) setState(next);
  }

  useEffect(() => {
    void refreshState();
    const timer = window.setInterval(() => void refreshState(), 2000);
    return () => {
      window.clearInterval(timer);
      stopHeartbeat();
    };
  }, []);

  function stopHeartbeat() {
    if (heartbeatRef.current === null) return;
    window.clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
  }

  function ping(ws: WebSocket) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'PING', text: '' }));
    }
  }

  function startHeartbeat(ws: WebSocket) {
    stopHeartbeat();
    ping(ws);
    heartbeatRef.current = window.setInterval(() => ping(ws), 10_000);
  }

  function connect() {
    const current = wsRef.current;
    if (current && current.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(socketUrl(browserId(), nickname));
    wsRef.current = ws;
    ws.onopen = () => {
      setConnected(true);
      setNotice('WebSocket 연결됨');
      startHeartbeat(ws);
    };
    ws.onmessage = (event) => {
      const payload = parsePayload(JSON.parse(event.data));
      if (payload?.state) setState(payload.state);
      if (payload?.message) setNotice(payload.message);
    };
    ws.onclose = () => {
      stopHeartbeat();
      setConnected(false);
      setNotice('연결 종료');
      void refreshState();
    };
  }

  function leave() {
    wsRef.current?.send(JSON.stringify({ type: 'LEAVE', text: '' }));
    wsRef.current?.close();
  }

  function sendMessage() {
    if (!message.trim()) return;
    wsRef.current?.send(JSON.stringify({ type: 'MESSAGE', text: message.trim() }));
    setMessage('');
  }

  async function simulate(path: string, count: number) {
    const next = await postCount(path, count);
    if (next) setState(next);
  }

  async function reset() {
    const response = await fetch('/api/bff/chat/reset', { method: 'POST' });
    const next = response.ok ? parseState(await response.json()) : null;
    if (next) setState(next);
  }

  return (
    <>
      <Header />
      <main id="main-content">
        <section className="chat-hero">
          <div>
            <div className="eyebrow">WebSocket queue</div>
            <h1>랜덤채팅 대기열 실험실</h1>
            <p>기본 정원 3명, 이후 접속자는 Redis ZSET 대기열에서 순서대로 승격됩니다.</p>
          </div>
        </section>

        <ScenarioCaseBanner scenarioId="redis-chat-queue" />

        <ChatRoom
          state={state}
          connected={connected}
          nickname={nickname}
          message={message}
          notice={notice}
          currentUserId={currentUserId}
          currentStatus={currentStatus}
          onNicknameChange={setNickname}
          onMessageChange={setMessage}
          onConnect={connect}
          onLeave={leave}
          onSendMessage={sendMessage}
          onSimulate={(path, count) => void simulate(path, count)}
          onReset={() => void reset()}
        />
        <ChatDebug state={state} />
      </main>
      <Footer />
    </>
  );
}
