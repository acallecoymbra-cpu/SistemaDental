'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import styles from '@/app/portal.module.css';
import {
  MAX_MESSAGE_LENGTH,
  QUICK_REPLIES,
  WELCOME,
  reply,
  type ChatContext,
  type ChatLink,
} from './rules';

interface Message {
  id: number;
  from: 'bot' | 'user';
  text: string;
  links?: ChatLink[];
}

/**
 * Chat del portal (T-18): respuestas fijas por reglas, sin IA. Todo ocurre en el navegador:
 * lo que se escribe no se envía ni se guarda. Panel no modal: Escape lo cierra y el foco
 * vuelve al botón que lo abrió.
 */
export function ChatWidget({ context }: { context: ChatContext }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ id: 0, from: 'bot', text: WELCOME }]);
  const [draft, setDraft] = useState('');
  const toggleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else if (wasOpen.current) {
      // El botón se vuelve a dibujar al cerrar: el foco vuelve a él después.
      toggleRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  function close() {
    setOpen(false);
  }

  function send(text: string) {
    const clean = text.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!clean) {
      return;
    }
    const answer = reply(clean, context);
    setMessages((current) => [
      ...current,
      { id: nextId.current++, from: 'user', text: clean },
      { id: nextId.current++, from: 'bot', text: answer.text, links: answer.links },
    ]);
    setDraft('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(draft);
  }

  if (!open) {
    return (
      <button
        ref={toggleRef}
        type="button"
        className={styles.chatToggle}
        aria-expanded="false"
        aria-controls={`${id}-panel`}
        onClick={() => setOpen(true)}
      >
        Chat de ayuda
      </button>
    );
  }

  return (
    <section
      id={`${id}-panel`}
      className={styles.chatPanel}
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${id}-title`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          close();
        }
      }}
    >
      <div className={styles.chatHead}>
        <h2 id={`${id}-title`}>Chat de ayuda</h2>
        <button
          type="button"
          className={styles.chatClose}
          aria-label="Cerrar el chat"
          onClick={close}
        >
          ×
        </button>
      </div>
      <div
        ref={logRef}
        className={styles.chatLog}
        role="log"
        aria-live="polite"
        aria-label="Conversación"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`${styles.msg} ${message.from === 'bot' ? styles.msgBot : styles.msgUser}`}
          >
            {message.text}
            {message.links && message.links.length > 0 ? (
              <div className={styles.msgLinks}>
                {message.links.map((link) =>
                  link.external ? (
                    <a
                      key={link.href}
                      className={styles.chatLink}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <a key={link.href} className={styles.chatLink} href={link.href}>
                      {link.label}
                    </a>
                  ),
                )}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className={styles.quick} role="group" aria-label="Atajos">
        {QUICK_REPLIES.map((quick) => (
          <button key={quick} type="button" onClick={() => send(quick)}>
            {quick}
          </button>
        ))}
      </div>
      <p className={styles.chatNote}>Respuestas automáticas. No compartas datos personales aquí.</p>
      <form className={styles.chatForm} onSubmit={handleSubmit}>
        <label htmlFor={`${id}-input`} style={{ position: 'absolute', left: -9999 }}>
          Escribe tu pregunta
        </label>
        <input
          ref={inputRef}
          id={`${id}-input`}
          value={draft}
          maxLength={MAX_MESSAGE_LENGTH}
          autoComplete="off"
          placeholder="Escribe tu pregunta"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit">Enviar</button>
      </form>
    </section>
  );
}
