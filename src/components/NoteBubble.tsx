import { useEffect, useRef, type ReactNode } from 'react';

/** A note remains tappable for seat links; holding it opens its editing actions. */
export function NoteBubble({ className, children, onActions }: {
  className: string;
  children: ReactNode;
  onActions?: () => void;
}) {
  const action = useRef(onActions);
  action.current = onActions;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const press = useRef<{ id: number; x: number; y: number } | undefined>(undefined);
  const held = useRef(false);

  const cancel = () => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
    press.current = undefined;
  };

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const start = press.current;
      if (start && event.pointerId === start.id &&
          Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) cancel();
    };
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerup', cancel);
    document.addEventListener('pointercancel', cancel);
    document.addEventListener('scroll', cancel, true);
    window.addEventListener('blur', cancel);
    return () => {
      cancel();
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', cancel);
      document.removeEventListener('pointercancel', cancel);
      document.removeEventListener('scroll', cancel, true);
      window.removeEventListener('blur', cancel);
    };
  }, []);

  return <article
    className={className}
    tabIndex={onActions ? 0 : undefined}
    aria-haspopup={onActions ? 'dialog' : undefined}
    aria-keyshortcuts={onActions ? 'Shift+F10' : undefined}
    style={onActions ? { touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } : undefined}
    onPointerDown={event => {
      cancel();
      held.current = false;
      if (!onActions || event.button !== 0 || !event.isPrimary) return;
      press.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => {
        timer.current = undefined;
        held.current = true;
        action.current?.();
      }, 500);
    }}
    onClickCapture={event => {
      if (!held.current) return;
      event.preventDefault();
      event.stopPropagation();
      held.current = false;
    }}
    onContextMenu={event => {
      if (!onActions) return;
      event.preventDefault();
      cancel();
      if (!held.current) {
        held.current = true;
        onActions();
      }
    }}
    onKeyDown={event => {
      if (!onActions || event.target !== event.currentTarget) return;
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10') || event.key === 'Enter') {
        event.preventDefault();
        cancel();
        if (!event.repeat) onActions();
      }
    }}
  >{children}</article>;
}
