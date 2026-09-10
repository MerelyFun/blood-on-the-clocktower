import { useState } from 'react';
import { roleArt } from '../lib/art';

// Optional replacement for the existing RoleToken only after copying art.ts to src/lib.
// Keep the original component's Role type if adopting directly into ui.tsx.
// The caller remains responsible for supplying ONLY an already-authorized display role.
type DisplayRole = { id: string; name: string; team: string };
export function RoleToken({ role, small = false, alignment }: {
  role?: DisplayRole | null; small?: boolean; alignment?: string;
}) {
  const src = roleArt(role);
  const [failedSrc, setFailedSrc] = useState<string | undefined>();
  const useImage = Boolean(src && src !== failedSrc);
  const side = alignment || ((role?.team === 'minion' || role?.team === 'demon') ? 'evil' : 'good');
  const classes = [
    'role-token', small ? 'small' : '', side,
    role?.team === 'traveller' ? 'traveller' : '', useImage ? 'has-art' : ''
  ].filter(Boolean).join(' ');
  return <span className={classes}>
    {useImage ? <img src={src} alt="" decoding="async"
      width={small ? 26 : 44} height={small ? 26 : 44}
      onError={() => setFailedSrc(src)} />
      : <span>{role?.name?.slice(0, 1) || '?'}</span>}
  </span>;
}
