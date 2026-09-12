import { useCallback, useEffect, useRef, useState } from 'react';
import type { Notebook } from './notebooks';
import { readDraft, writeDraft, saveNotebook, deleteNotebook, NotebookConflictError, type NotebookContext, type NotebookDraft } from './notebookStorage';

/** Persist input before rendering it, and serialize remote acknowledgements. */
export function useNotebook(initial: NotebookDraft, context: NotebookContext) {
  const [draft, setDraft] = useState(initial);
  const current = useRef(initial);
  const ctx = useRef(context); ctx.current = context;
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true), blocked = useRef(false), stopped = useRef(false);
  const inFlight = useRef<Promise<void> | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const publish = (next: NotebookDraft) => { current.current = next; if (mounted.current) setDraft(next); };
  const acceptFailure = (e: unknown) => {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof NotebookConflictError) {
      // Storage has already preserved our input in a separate notebook. Continue
      // from the winning token so the next keystroke cannot create another copy.
      const winner = e.current || readDraft(e.preserved.id, ctx.current);
      if (winner) publish(winner);
      blocked.current = true;
      clearTimeout(timer.current);
    } else if (/冲突|其他|版本|conflict/i.test(message)) blocked.current = true;
    if (mounted.current) setError(message);
  };
  const flush = useCallback((): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    if (stopped.current || blocked.current || !current.current.dirty) return Promise.resolve();
    if (mounted.current) setSaving(true);
    const sent = current.current, requestContext = ctx.current;
    const request = (async () => {
      try {
        const saved = await saveNotebook(sent.data, requestContext, sent.token);
        const newest = readDraft(sent.data.id, requestContext) || saved;
        publish(newest);
        if (mounted.current) setError('');
        if (newest.dirty && !stopped.current && mounted.current) timer.current = setTimeout(() => void flush(), 800);
      } catch (e) { acceptFailure(e); }
      finally {
        inFlight.current = undefined;
        if (mounted.current) setSaving(false);
      }
    })();
    inFlight.current = request;
    return request;
  }, []);
  const update = useCallback((change: (book: Notebook) => Notebook) => {
    if (stopped.current) return;
    const old = current.current;
    const next = change(old.data);
    if (next === old.data) return;
    try {
      const saved = writeDraft({ ...next, updatedAt: new Date().toISOString() }, ctx.current, old.token);
      publish(saved);
      if (!blocked.current) setError('');
      clearTimeout(timer.current);
      if (!blocked.current) timer.current = setTimeout(() => void flush(), 800);
    } catch (e) { acceptFailure(e); }
  }, [flush]);
  const remove = useCallback(async () => {
    if (stopped.current) return;
    stopped.current = true;
    clearTimeout(timer.current);
    const requestContext = ctx.current;
    try {
      // Deletion follows any acknowledgement, including its cache revision update.
      await inFlight.current;
      await deleteNotebook(current.current.data.id, requestContext);
    } catch (e) {
      stopped.current = false;
      acceptFailure(e);
      throw e;
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    const online = () => { if (!blocked.current) void flush(); };
    const hide = () => { if (document.visibilityState === 'hidden') void flush(); };
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', hide);
    if (current.current.dirty) timer.current = setTimeout(() => void flush(), 800);
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
      if (!stopped.current) void flush();
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [flush]);
  return { book: draft.data, update, remove, error, saving, dirty: draft.dirty,
    retry: () => { blocked.current = false; void flush(); } };
}
