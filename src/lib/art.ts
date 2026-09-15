/** Static art from the supplied Clocktower asset pack.
 * Public resources live in public/art and respect the deployment base path.
 * No Supabase change is required. Do not call roleArt with secret data in public views.
 */
export function artUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}

export const ROLE_ART: Readonly<Record<string, string>> = {
  "grandmother": "art/roles/grandmother.webp",
  "sailor": "art/roles/sailor.webp",
  "chambermaid": "art/roles/chambermaid.webp",
  "exorcist": "art/roles/exorcist.webp",
  "innkeeper": "art/roles/innkeeper.webp",
  "gambler": "art/roles/gambler.webp",
  "gossip": "art/roles/gossip.webp",
  "courtier": "art/roles/courtier.webp",
  "professor": "art/roles/professor.webp",
  "minstrel": "art/roles/minstrel.webp",
  "tealady": "art/roles/tealady.webp",
  "pacifist": "art/roles/pacifist.webp",
  "fool": "art/roles/fool.webp",
  "goon": "art/roles/goon.webp",
  "lunatic": "art/roles/lunatic.webp",
  "tinker": "art/roles/tinker.webp",
  "moonchild": "art/roles/moonchild.webp",
  "godfather": "art/roles/godfather.webp",
  "devilsadvocate": "art/roles/devilsadvocate.webp",
  "assassin": "art/roles/assassin.webp",
  "mastermind": "art/roles/mastermind.webp",
  "zombuul": "art/roles/zombuul.webp",
  "pukka": "art/roles/pukka.webp",
  "shabaloth": "art/roles/shabaloth.webp",
  "po": "art/roles/po.webp",
  "clockmaker": "art/roles/clockmaker.webp",
  "dreamer": "art/roles/dreamer.webp",
  "snakecharmer": "art/roles/snakecharmer.webp",
  "mathematician": "art/roles/mathematician.webp",
  "flowergirl": "art/roles/flowergirl.webp",
  "towncrier": "art/roles/towncrier.webp",
  "oracle": "art/roles/oracle.webp",
  "savant": "art/roles/savant.webp",
  "seamstress": "art/roles/seamstress.webp",
  "philosopher": "art/roles/philosopher.webp",
  "artist": "art/roles/artist.webp",
  "juggler": "art/roles/juggler.webp",
  "sage": "art/roles/sage.webp",
  "mutant": "art/roles/mutant.webp",
  "sweetheart": "art/roles/sweetheart.webp",
  "barber": "art/roles/barber.webp",
  "klutz": "art/roles/klutz.webp",
  "eviltwin": "art/roles/eviltwin.webp",
  "witch": "art/roles/witch.webp",
  "cerenovus": "art/roles/cerenovus.webp",
  "pithag": "art/roles/pithag.webp",
  "fanggu": "art/roles/fanggu.webp",
  "vigormortis": "art/roles/vigormortis.webp",
  "nodashii": "art/roles/nodashii.webp",
  "vortox": "art/roles/vortox.webp",

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
  "demon": "art/teams/demon.webp",
  "traveller": "art/teams/traveller.webp",
  "fabled": "art/teams/fabled.webp",
  "loric": "art/teams/loric.webp"
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
  "ability-used": "art/status/ability-used.webp",
  "pending-death": "art/status/pending-death.webp",
  "exile": "art/status/exile.webp",
  "drunk": "art/status/drunk.webp",
  "ready": "art/status/ready.webp",
  "waiting": "art/status/waiting.webp",
  "message": "art/status/message.webp",
  "private": "art/status/private.webp",
  "ghost-vote-available": "art/status/ghost-vote-available.webp",
  "ghost-vote-used": "art/status/ghost-vote-used.webp"
};

export const SCRIPT_ART: Readonly<Record<string, string>> = {
  "tb": "art/scripts/tb.webp",
  "bmr": "art/scripts/bmr.webp",
  "snv": "art/scripts/snv.webp",
  "custom": "art/scripts/custom.webp"
};

// Only exact, known reminder labels receive an icon; custom reminders keep their text.
const REMINDER_STATUS: Readonly<Record<string, string>> = {
  '醉酒': 'drunk', '中毒': 'poisoned', '保护': 'protected',
  '能力已用': 'ability-used', '待公布死亡': 'pending-death'
};
export function reminderStatus(label: string): string | undefined {
  return Object.hasOwn(REMINDER_STATUS, label) ? REMINDER_STATUS[label] : undefined;
}

export function roleArt(role?: { id?: string; team?: string; custom?: boolean; raw?: Record<string, unknown> } | null): string | undefined {
  if (!role) return undefined;
  // Unmapped/custom roles retain their own name initial instead of a misleading icon.
  const path = role.id && Object.hasOwn(ROLE_ART, role.id) ? ROLE_ART[role.id] : undefined;
  if (path && !role.custom) return artUrl(path);
  const images = Array.isArray(role.raw?.image) ? role.raw.image : [role.raw?.image];
  const supplied = images.find((image): image is string => typeof image === 'string' && /^https?:\/\//i.test(image));
  return supplied || (path ? artUrl(path) : undefined);
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

