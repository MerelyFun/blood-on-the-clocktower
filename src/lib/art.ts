/** Static art from the supplied Clocktower asset pack.
 * Public resources live in public/art and respect the deployment base path.
 * No Supabase change is required. Do not call roleArt with secret data in public views.
 */
export function artUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}

export const ROLE_ART: Readonly<Record<string, string>> = {
  "washerwoman": "art/roles/washerwoman.webp",
  "librarian": "art/roles/librarian.webp",
  "investigator": "art/roles/investigator.webp",
  "chef": "art/roles/chef.webp",
  "empath": "art/roles/empath.webp",
  "fortuneteller": "art/roles/fortuneteller.webp",
  "monk": "art/roles/monk.webp",
  "slayer": "art/roles/slayer.webp",
  "mayor": "art/roles/mayor.webp",
  "drunk": "art/roles/drunk.webp",
  "spy": "art/roles/spy.webp",
  "imp": "art/roles/imp.webp",
  "undertaker": "art/roles/undertaker.webp",
  "virgin": "art/roles/virgin.webp",
  "soldier": "art/roles/soldier.webp",
  "butler": "art/roles/butler.webp",
  "saint": "art/roles/saint.webp",
  "poisoner": "art/roles/poisoner.webp",
  "baron": "art/roles/baron.webp",
  "ravenkeeper": "art/roles/ravenkeeper.webp",
  "recluse": "art/roles/recluse.webp",
  "scarletwoman": "art/roles/scarletwoman.webp"
};

export const TEAM_ART: Readonly<Record<string, string>> = {
  "townsfolk": "art/teams/townsfolk.webp",
  "outsider": "art/teams/outsider.webp",
  "minion": "art/teams/minion.webp",
  "demon": "art/roles/imp.webp",
  "traveller": "art/teams/traveller.webp",
  "fabled": "art/teams/fabled.webp",
  "loric": "art/decoration/scroll-banner.webp"
};

export const STATUS_ART: Readonly<Record<string, string>> = {
  "alive": "art/status/alive.webp",
  "dead": "art/status/dead.webp",
  "poisoned": "art/status/poisoned.webp",
  "nomination": "art/status/nomination.webp",
  "execution": "art/status/execution.webp",
  "protected": "art/status/protected.webp",
  "unavailable": "art/status/unavailable.webp",
  "night-action": "art/status/night-action.webp",
  "confused": "art/status/confused.webp",
  "ability-used": "art/teams/fabled.webp",
  "drunk": "art/roles/drunk.webp",
  "ready": "art/status/ready.webp",
  "waiting": "art/status/waiting.webp",
  "message": "art/status/message.webp",
  "private": "art/status/private.webp",
  "ghost-vote-available": "art/status/ghost-vote-available.webp",
  "ghost-vote-used": "art/status/ghost-vote-used.webp"
};

export const SCRIPT_ART: Readonly<Record<string, string>> = {
  "tb": "art/backgrounds/town-night-red.webp",
  "bmr": "art/backgrounds/clocktower-close.webp",
  "snv": "art/decoration/mystery-sigil.webp",
  "custom": "art/decoration/scroll-banner.webp"
};

export function roleArt(role?: { id?: string; team?: string } | null): string | undefined {
  if (!role) return undefined;
  // Unmapped/custom roles retain their own name initial instead of a misleading icon.
  const path = role.id && Object.hasOwn(ROLE_ART, role.id) ? ROLE_ART[role.id] : undefined;
  return path ? artUrl(path) : undefined;
}
export function scriptArt(script?: { id?: string; meta?: Record<string, unknown> } | null): string {
  const english = script?.meta?.english;
  const alias: Record<string, string> = {
    'Trouble Brewing': 'tb', 'Bad Moon Rising': 'bmr', 'Sects & Violets': 'snv'
  };
  const id = script?.id && Object.hasOwn(SCRIPT_ART, script.id)
    ? script.id : typeof english === 'string' && Object.hasOwn(alias, english) ? alias[english] : 'custom';
  return artUrl(SCRIPT_ART[id ?? 'custom'] ?? SCRIPT_ART.custom);
}
export function phaseArt(phase: string): string | undefined {
  if (phase === 'night') return artUrl('art/backgrounds/town-night-blue.webp');
  if (phase === 'day') return artUrl('art/backgrounds/town-day.webp');
  return undefined; // Setup/ended must not be misrepresented as a day/night scene.
}

