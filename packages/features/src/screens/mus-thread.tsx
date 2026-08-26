'use client';

import { Check, Clock, PaperPlaneTilt, PushPin } from '@phosphor-icons/react';
import {
  appendLocalCocoMessage,
  createLocalAgentMemory,
  createLocalCocoConversation,
  listLocalCocoMessages,
  type LocalCocoMessage,
} from '@kayamo/offline';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { apiFetch } from '../api/api-origin';
import { musReplyFromApi } from '../mus/mus-reply';
import styles from './kayamo-app.module.css';

export function MusThread({ userId, logicalDate, recommended }: {
  userId: string;
  logicalDate: string;
  recommended: string | null;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalCocoMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [rememberedMessageId, setRememberedMessageId] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 136)}px`;
  }, [text]);

  useEffect(() => {
    if (conversationId) return;
    void createLocalCocoConversation({ userId, title: `Mus · ${logicalDate}` }).then((conversation) => {
      setConversationId(conversation.id);
      setMessages([]);
    });
  }, [conversationId, logicalDate, userId]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const message = text.trim();
    if (!message || !conversationId || busy) return;
    setText('');
    setBusy(true);
    try {
      const local = await appendLocalCocoMessage({ userId, conversationId, role: 'user', content: message });
      setMessages((current) => [...current, local]);
      let reply = recommended
        ? `I’m here. Your confirmed next action is “${recommended}.” We can make it smaller, but I won’t change it without you.`
        : 'I’m here. We can name one small next action together, and nothing will be saved until you confirm it.';
      let source: LocalCocoMessage['response_source'] = 'fallback';
      try {
        const response = await apiFetch('/api/mus/respond', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ requestId: crypto.randomUUID(), mode: 'chat', message, logicalDate }),
        });
        if (response.ok) {
          const parsed = musReplyFromApi(await response.json());
          if (parsed) {
            reply = parsed.message;
            source = parsed.source;
          }
        }
      } catch {
        // The deterministic reply keeps Mus useful offline.
      }
      const mus = await appendLocalCocoMessage({
        userId,
        conversationId,
        role: 'assistant',
        content: reply,
        responseSource: source,
      });
      setMessages((current) => [...current, mus]);
    } finally {
      setBusy(false);
    }
  }

  async function rememberMessage(message: LocalCocoMessage) {
    await createLocalAgentMemory({
      userId,
      kind: 'conversation_note',
      content: message.content,
      confirmed: true,
    });
    setRememberedMessageId(message.id);
  }

  useEffect(() => {
    if (!conversationId) return;
    void listLocalCocoMessages(userId, conversationId).then(setMessages);
  }, [conversationId, userId]);

  return (
    <div className={`${styles.screen} ${styles.musScreen}`} aria-labelledby="mus-chat-title">
      <header className={styles.chatHeader}>
        <img src="/coco-seed.png" alt="" width={48} height={48} />
        <div><h2 id="mus-chat-title">Mus</h2><p>tone · balanced · adapts to the moment</p></div>
        <button className={styles.chatHistoryButton} type="button" aria-label="Conversation history"><Clock size={19} /></button>
      </header>
      <div className={styles.chatMessages} aria-live="polite">
        {messages.length === 0 ? <div className={styles.cocoBubble}>I’m with you. We can talk, reflect, or choose one realistic next step.</div> : null}
        {messages.map((message) => message.role === 'user' ? (
          <div key={message.id} className={styles.userBubble}>{message.content}</div>
        ) : (
          <div key={message.id} className={styles.cocoMessageGroup}>
            <div className={styles.cocoBubble}>{message.content}</div>
            {recommended ? <p className={styles.chatSource}><Clock size={13} /> From your confirmed plan for today.</p> : null}
            <button className={styles.rememberButton} type="button" onClick={() => void rememberMessage(message)} disabled={rememberedMessageId === message.id}>
              {rememberedMessageId === message.id ? <Check size={15} /> : <PushPin size={15} />} {rememberedMessageId === message.id ? 'Remembered' : 'Remember this'}
            </button>
          </div>
        ))}
        {busy ? <div className={styles.cocoBubble}>Thinking carefully…</div> : null}
      </div>
      <form className={styles.chatComposer} onSubmit={send}>
        <label className={styles.srOnly} htmlFor="mus-message">
          Message Mus. Enter sends. Shift+Enter starts a new line.
        </label>
        <textarea
          id="mus-message"
          ref={composerRef}
          rows={2}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }}
          placeholder="Say what’s actually going on…"
        />
        <button type="submit" disabled={!text.trim() || busy} aria-label="Send message">
          <PaperPlaneTilt size={21} weight="fill" />
        </button>
      </form>
      <p className={styles.chatPrivacy}>Mus proposes. You confirm every write.</p>
    </div>
  );
}
