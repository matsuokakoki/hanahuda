export type CardCategory = 'bright' | 'animal' | 'ribbon' | 'chaff';
export type AttackClass = 'infantry' | 'cavalry' | 'ranged' | 'special';
export interface Card { id: string; month: number; name: string; category: CardCategory; yakuTags: string[] }
export interface Yaku { id: string; name: string; points: number }
export type CharacterId = 'date_masamune' | 'maeda_keiji' | 'mori_motonari' | 'sanada_yukimura' | 'tokugawa_ieyasu' | 'hojo_ujiyasu' | 'uesugi_kenshin' | 'saika_magoichi' | 'takeda_shingen' | 'oda_nobunaga' | 'toyotomi_hideyoshi' | 'shimazu_yoshihiro';
export interface Character { id: CharacterId; month: number; normalName: string; awakenedName: string; army: string; specialEffectId: string }
export type Effect =
  | { type: 'DAMAGE'; amount: number; attackClass: AttackClass; normalAttack: boolean }
  | { type: 'HEAL'; amount: number }
  | { type: 'COIN'; heads: number; tailsSelfDamage: number; attackClass: AttackClass }
  | { type: 'ADD_FIELD_FROM_DECK'; count: number }
  | { type: 'RANDOM_HAND_TO_FIELD' };
export interface PlayerState {
  uid: string; hp: number; hand: string[]; captured: string[]; characterId: CharacterId;
  awakened: boolean; yaku: Yaku[]; score: number; statuses: Record<string, number | boolean>;
}
export type GamePhase = 'PLAY_CARD' | 'CHOOSE_HAND_MATCH' | 'CHOOSE_DRAW_MATCH' | 'FINISHED';
export interface PendingChoice { source: 'hand' | 'draw'; playedCardId: string; options: string[] }
export interface GameState {
  players: [PlayerState, PlayerState]; activePlayerIndex: 0 | 1; field: string[]; deck: string[];
  phase: GamePhase; pendingChoice?: PendingChoice; pendingAwakeningPlayer?: 0 | 1;
  turnStartScore: number; stateVersion: number; rngState: string; rngCounter: number;
  status: 'ACTIVE' | 'FINISHED'; winnerUid: string | null; finishReason: string | null;
  turnNumber: number; deadlineMs: number; eventLog: GameEvent[];
}
export type GameCommand =
  | { type: 'PLAY_CARD'; cardId: string }
  | { type: 'CHOOSE_MATCH'; matchedCardId: string };
export interface GameEvent { type: string; actorUid?: string; cardId?: string; amount?: number; message: string }
export interface ReduceResult { state: GameState; events: GameEvent[] }
