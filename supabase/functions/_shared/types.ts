export type Team = 'townsfolk' | 'outsider' | 'minion' | 'demon' | 'traveller' | 'fabled' | 'loric';
export type Alignment = 'good' | 'evil';
export type Phase = 'setup' | 'night' | 'day' | 'ended';
export interface Role {
  id: string; name: string; team: Team; ability: string; edition?: string;
  firstNight: number; otherNight: number; firstNightReminder?: string; otherNightReminder?: string;
  reminders: string[]; setup?: boolean; custom?: boolean; unresolved?: boolean;
  raw?: Record<string, unknown>;
}
export interface Script {
  id: string; name: string; author: string; description: string; version: number;
  roles: Role[]; meta: Record<string, unknown>; extras: unknown[]; updatedAt: string;
}
export interface Seat {
  id: string; index: number; name: string; traveller: boolean; left: boolean;
  roleId: string; shownRoleId: string; alignment: Alignment; shownAlignment: Alignment;
  alive: boolean; publicAlive: boolean; voteAvailable: boolean; cardVersion: number; acknowledged: number;
}
export interface Reminder { id: string; target: string; source: string; label: string; duration: 'manual'|'dawn'|'dusk'; }
export interface NightTask { id: string; seatId: string; label: string; order: number; done: boolean; note: string; targets: string[]; }
export interface GrimCard { name: string; index: number; role: string; alignment: Alignment; alive: boolean; reminders: string[]; }
export interface PrivateMessage {
  id: string; seatId: string; at: string; round: number; kind: 'info'|'choice'|'grimoire';
  text: string; options: string[]; min: number; max: number; response: string[]|null;
  seen: boolean; snapshot?: GrimCard[];
}
export interface GameEvent { id: string; at: string; round: number; phase: Phase; text: string; visibility: 'public'|'host'; }
export interface Nomination {
  id: string; round: number; type: 'nomination'|'exile'; nominator: string; nominee: string;
  voters: string[]; threshold: number; tally: number; adjustment: number; reason: string;
  status: 'open'|'tallied'|'executed'|'cancelled'; dies?: boolean;
}
export interface PublicSeat { id: string; index: number; name: string; traveller: boolean; left: boolean; alive: boolean; voteAvailable: boolean; role?: Role; }
export interface Review { at: string; winner: string; text: string; seats: GrimCard[]; }
export interface Timer { endsAt: number|null; remaining: number; }
export interface Game {
  schemaVersion: 1; id: string; code: string; title: string; createdAt: string; updatedAt: string; version: number;
  script: Script; phase: Phase; round: number; paused: boolean; locked: boolean;
  seats: Seat[]; bluffs: string[]; fabled: string[]; reminders: Reminder[]; nightTasks: NightTask[];
  messages: PrivateMessage[]; notes: Record<string,string>; nominations: Nomination[]; events: GameEvent[];
  timer: Timer; winner: string; review: Review|null; snapshots: Snapshot[];
}
export interface Snapshot { id: string; at: string; label: string; state: Omit<Game,'snapshots'>; }
export interface PublicGame {
  id: string; code: string; title: string; script: Script; phase: Phase; round: number; paused: boolean;
  seats: PublicSeat[]; events: GameEvent[]; nominations: Omit<Nomination,'voters'|'adjustment'|'reason'>[];
  timer: Timer; winner: string; review: Review|null; fabled: Role[];
}
export interface PersonalView { seatId: string; cardVersion: number; acknowledged: number; role: Role|null; alignment: Alignment|null; messages: PrivateMessage[]; }
export interface Member { user_id: string; nickname: string; role: 'host'|'player'; status: 'pending'|'active'|'revoked'; seat_id: string|null; }
export type RoomView = { kind: 'host'; game: Game; members: Member[] } | {kind:'player'; room:PublicGame; personal: PersonalView} | {kind:'pending'; id:string; title:string; status:string};
export interface Command { type: string; payload?: Record<string,unknown>; }
export type Actor = { kind:'host' } | { kind:'player'; seatId:string };
export const TEAM_LABELS: Record<Team,string> = {townsfolk:'镇民',outsider:'外来者',minion:'爪牙',demon:'恶魔',traveller:'旅行者',fabled:'传奇角色',loric:'奇遇角色'};
export const TEAMS: Team[] = ['townsfolk','outsider','minion','demon','traveller','fabled','loric'];
