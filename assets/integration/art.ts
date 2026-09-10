/** Optional static-image integration for this uploaded Clocktower source version.
 * Copy this file to src/lib/art.ts and copy public/art into the app's public/art.
 * No Supabase change is required. Do not call roleArt with secret data in public views.
 */
export function artUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}

export const ROLE_ART: Readonly<Record<string, string>> = {
  "washerwoman": "art/roles/washerwoman.png",
  "librarian": "art/roles/librarian.png",
  "investigator": "art/roles/investigator.png",
  "chef": "art/roles/chef.png",
  "empath": "art/roles/empath.png",
  "fortuneteller": "art/roles/fortuneteller.png",
  "monk": "art/roles/monk.png",
  "slayer": "art/roles/slayer.png",
  "mayor": "art/roles/mayor.png",
  "drunk": "art/roles/drunk.png",
  "spy": "art/roles/spy.png",
  "imp": "art/roles/imp.png",
  "undertaker": "art/roles/undertaker.png",
  "virgin": "art/roles/virgin.png",
  "soldier": "art/roles/soldier.png",
  "butler": "art/roles/butler.png",
  "saint": "art/roles/saint.png",
  "poisoner": "art/roles/poisoner.png",
  "baron": "art/roles/baron.png",
  "ravenkeeper": "art/roles/ravenkeeper.png",
  "recluse": "art/roles/recluse.png",
  "scarletwoman": "art/roles/scarletwoman.png"
};

export const TEAM_ART: Readonly<Record<string, string>> = {
  "townsfolk": "art/teams/townsfolk.png",
  "outsider": "art/teams/outsider.png",
  "minion": "art/teams/minion.png",
  "demon": "art/roles/imp.png",
  "traveller": "art/teams/traveller.png",
  "fabled": "art/teams/fabled.png",
  "loric": "art/decoration/scroll-banner.png"
};

export const STATUS_ART: Readonly<Record<string, string>> = {
  "alive": "art/status/alive.png",
  "dead": "art/status/dead.png",
  "poisoned": "art/status/poisoned.png",
  "nomination": "art/status/nomination.png",
  "execution": "art/status/execution.png",
  "protected": "art/status/protected.png",
  "unavailable": "art/status/unavailable.png",
  "night-action": "art/status/night-action.png",
  "confused": "art/status/confused.png",
  "ability-used": "art/teams/fabled.png",
  "drunk": "art/roles/drunk.png",
  "ready": "art/status/ready.png",
  "waiting": "art/status/waiting.png",
  "message": "art/status/message.png",
  "private": "art/status/private.png",
  "ghost-vote-available": "art/status/ghost-vote-available.png",
  "ghost-vote-used": "art/status/ghost-vote-used.png"
};

export const SCRIPT_ART: Readonly<Record<string, string>> = {
  "tb": "art/backgrounds/town-night-red.png",
  "bmr": "art/backgrounds/clocktower-close.png",
  "snv": "art/decoration/mystery-sigil.png",
  "custom": "art/decoration/scroll-banner.png"
};

export function roleArt(role?: { id?: string; team?: string } | null): string | undefined {
  if (!role) return undefined;
  const path = (role.id ? ROLE_ART[role.id] : undefined)
    ?? (role.team ? TEAM_ART[role.team] : undefined);
  return path ? artUrl(path) : undefined;
}
export function scriptArt(script?: { id?: string; meta?: Record<string, unknown> } | null): string {
  const english = script?.meta?.english;
  const alias: Record<string, string> = {
    'Trouble Brewing': 'tb', 'Bad Moon Rising': 'bmr', 'Sects & Violets': 'snv'
  };
  const id = script?.id && SCRIPT_ART[script.id]
    ? script.id : typeof english === 'string' ? alias[english] : 'custom';
  return artUrl(SCRIPT_ART[id ?? 'custom'] ?? SCRIPT_ART.custom);
}
export function phaseArt(phase: string): string | undefined {
  if (phase === 'night') return artUrl('art/backgrounds/town-night-blue.png');
  if (phase === 'day') return artUrl('art/backgrounds/town-day.png');
  return undefined; // Setup/ended must not be misrepresented as a day/night scene.
}
