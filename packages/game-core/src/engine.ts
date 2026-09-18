import { createHash } from 'node:crypto';
import { CARDS, CARD_BY_ID } from './cards.js';
import { CHARACTERS, CHARACTER_BY_ID, finisherDamage, tacticEffects } from './characters.js';
import { calculateYaku, totalScore } from './yaku.js';
import type { Effect, GameCommand, GameEvent, GameState, PlayerState, ReduceResult } from './types.js';

const DAY = 60_000;
function nextRandom(state: GameState): number {
  const hash = createHash('sha256').update(`${state.rngState}:${state.rngCounter++}`).digest();
  return hash.readUInt32BE(0) / 0x1_0000_0000;
}
function shuffled(seed: string): string[] {
  const state = { rngState: seed, rngCounter: 0 } as GameState;
  const ids = CARDS.map((card) => card.id);
  for (let index = ids.length - 1; index > 0; index--) {
    const swap = Math.floor(nextRandom(state) * (index + 1));
    [ids[index], ids[swap]] = [ids[swap]!, ids[index]!];
  }
  return ids;
}
function invalidDeal(hand: string[], field = false): boolean {
  const counts = new Map<number, number>();
  hand.forEach((id) => { const month = CARD_BY_ID.get(id)!.month; counts.set(month, (counts.get(month) ?? 0) + 1); });
  if ([...counts.values()].some((count) => count === 4)) return true;
  return !field && [...counts.values()].filter((count) => count === 2).length === 4;
}
function dealRound(seed: string) {
  let deck: string[] = [];
  let hands: [string[], string[]] = [[], []];
  let field: string[] = [];
  for (let attempt = 0; attempt < 100; attempt++) {
    deck = shuffled(`${seed}:${attempt}`);
    hands = [deck.splice(0, 8), deck.splice(0, 8)]; field = deck.splice(0, 8);
    if (!invalidDeal(hands[0]) && !invalidDeal(hands[1]) && !invalidDeal(field, true)) break;
    if (attempt === 99) throw new Error('安全な初期配札を作れませんでした');
  }
  return { deck, hands, field };
}
export function initializeGame(uids: [string, string], seed: string, now = Date.now()): GameState {
  const { deck, hands, field } = dealRound(seed);
  const hash = createHash('sha256').update(seed).digest();
  const activePlayerIndex = (hash[0]! % 2) as 0 | 1;
  const players = uids.map((uid, index): PlayerState => ({ uid, hp: 300, hand: hands[index]!, captured: [], characterId: CHARACTERS[hash[index + 1]! % 12]!.id, awakened: false, yaku: [], score: 0, statuses: {} })) as [PlayerState, PlayerState];
  return { players, activePlayerIndex, field, deck, phase: 'PLAY_CARD', turnStartScore: 0, stateVersion: 1, rngState: seed, rngCounter: 0, status: 'ACTIVE', winnerUid: null, finishReason: null, turnNumber: 1, deadlineMs: now + DAY, eventLog: [] };
}
const clone = (state: GameState): GameState => structuredClone(state);
const opponentIndex = (index: 0 | 1): 0 | 1 => index === 0 ? 1 : 0;
const clamp = (value: number) => Math.max(0, Math.min(300, value));

function damage(state: GameState, attackerIndex: 0 | 1, raw: number, normal: boolean, events: GameEvent[]): void {
  const defenderIndex = opponentIndex(attackerIndex); const attacker = state.players[attackerIndex]; const defender = state.players[defenderIndex];
  let amount = raw;
  if (defender.characterId === 'hojo_ujiyasu' && defender.awakened) amount = Math.max(0, amount - 20);
  if (normal && defender.statuses.normalShield) { defender.statuses.normalShield = false; amount = 0; }
  defender.hp = clamp(defender.hp - amount);
  events.push({ type: 'DAMAGE', actorUid: attacker.uid, amount, message: `${amount}ダメージ` });
  if (defender.hp === 0 && defender.characterId === 'shimazu_yoshihiro' && defender.awakened && !defender.statuses.lastStandUsed) {
    defender.statuses.lastStandUsed = true; defender.hp = 10; events.push({ type: 'LAST_STAND', message: '鬼島津がHP10で耐えた' });
  }
}
function applyEffects(state: GameState, actorIndex: 0 | 1, effects: Effect[], events: GameEvent[]): void {
  const actor = state.players[actorIndex]; const opponent = state.players[opponentIndex(actorIndex)];
  for (const effect of effects) {
    if (effect.type === 'DAMAGE') damage(state, actorIndex, effect.amount, effect.normalAttack, events);
    if (effect.type === 'HEAL') { actor.hp = clamp(actor.hp + effect.amount); events.push({ type: 'HEAL', actorUid: actor.uid, amount: effect.amount, message: `${effect.amount}回復` }); }
    if (effect.type === 'COIN') { const heads = nextRandom(state) < 0.5; if (heads) damage(state, actorIndex, effect.heads, true, events); else if (effect.tailsSelfDamage > 0) { actor.hp = clamp(actor.hp - effect.tailsSelfDamage); events.push({ type: 'SELF_DAMAGE', actorUid: actor.uid, amount: effect.tailsSelfDamage, message: `裏：自分に${effect.tailsSelfDamage}ダメージ` }); } else damage(state, actorIndex, -effect.tailsSelfDamage, true, events); events.push({ type: 'COIN', actorUid: actor.uid, message: heads ? 'コインは表' : 'コインは裏' }); }
    if (effect.type === 'ADD_FIELD_FROM_DECK') { for (let i = 0; i < effect.count && state.deck.length; i++) state.field.push(state.deck.shift()!); }
    if (effect.type === 'RANDOM_HAND_TO_FIELD' && !actor.statuses.handDiscardUsed && opponent.hand.length) { const at = Math.floor(nextRandom(state) * opponent.hand.length); state.field.push(opponent.hand.splice(at, 1)[0]!); actor.statuses.handDiscardUsed = true; }
  }
  if (actor.characterId === 'tokugawa_ieyasu' && actor.awakened) { actor.hp = clamp(actor.hp + 10); events.push({ type: 'HEAL', actorUid: actor.uid, amount: 10, message: '覚醒効果で10回復' }); }
  if (opponent.characterId === 'tokugawa_ieyasu' && opponent.awakened) { actor.hp = clamp(actor.hp - 20); events.push({ type: 'DAMAGE', actorUid: opponent.uid, amount: 20, message: '徳川家康の反撃で20ダメージ' }); }
  forceAwaken(state, actorIndex, events); forceAwaken(state, opponentIndex(actorIndex), events);
  checkHpEnd(state, events);
}
function forceAwaken(state: GameState, index: 0 | 1, events: GameEvent[]) { const p = state.players[index]; if (!p.awakened && p.hp >= 1 && p.hp < 100) { p.awakened = true; events.push({ type: 'FORCED_AWAKENING', actorUid: p.uid, message: `HP100未満：${CHARACTER_BY_ID.get(p.characterId)!.awakenedName}へ覚醒` }); } }
function checkHpEnd(state: GameState, events: GameEvent[]) {
  const [a, b] = state.players; if (a.hp > 0 && b.hp > 0) return;
  state.status = 'FINISHED'; state.phase = 'FINISHED'; state.winnerUid = a.hp === 0 && b.hp === 0 ? null : a.hp > 0 ? a.uid : b.uid; state.finishReason = a.hp === 0 && b.hp === 0 ? 'DRAW' : 'HP_ZERO'; events.push({ type: 'FINISHED', message: state.winnerUid ? `${state.winnerUid}の勝利` : '引き分け' });
}
function capture(state: GameState, actorIndex: 0 | 1, playedCardId: string, matchedIds: string[], events: GameEvent[]) {
  const actor = state.players[actorIndex]; actor.captured.push(playedCardId, ...matchedIds);
  state.field = state.field.filter((id) => !matchedIds.includes(id));
  events.push({ type: 'CAPTURE', actorUid: actor.uid, cardId: playedCardId, message: `${CARD_BY_ID.get(playedCardId)!.month}月札を取得` });
  applyEffects(state, actorIndex, tacticEffects(actor.characterId, actor.awakened, CARD_BY_ID.get(playedCardId)!.month), events);
}
function resolveCard(state: GameState, actorIndex: 0 | 1, cardId: string, source: 'hand' | 'draw', events: GameEvent[]): boolean {
  const month = CARD_BY_ID.get(cardId)!.month; const matches = state.field.filter((id) => CARD_BY_ID.get(id)!.month === month);
  if (matches.length === 2) { state.phase = source === 'hand' ? 'CHOOSE_HAND_MATCH' : 'CHOOSE_DRAW_MATCH'; state.pendingChoice = { source, playedCardId: cardId, options: matches }; return false; }
  if (matches.length === 0) { state.field.push(cardId); events.push({ type: 'FIELD', cardId, message: `${month}月札を場へ` }); }
  else capture(state, actorIndex, cardId, matches.length === 3 ? matches : [matches[0]!], events);
  return true;
}
function afterHand(state: GameState, actorIndex: 0 | 1, events: GameEvent[]) {
  if (state.status === 'FINISHED') return;
  const draw = state.deck.shift();
  if (draw && !resolveCard(state, actorIndex, draw, 'draw', events)) return;
  finishTurn(state, actorIndex, events);
}
function finishTurn(state: GameState, actorIndex: 0 | 1, events: GameEvent[]) {
  if (state.status === 'FINISHED') return;
  const actor = state.players[actorIndex]; actor.yaku = calculateYaku(actor.captured); actor.score = totalScore(actor.captured);
  const turnScore = Math.max(0, actor.score - state.turnStartScore);
  resolveScore(state, actorIndex, turnScore, events);
}
function resolveScore(state: GameState, actorIndex: 0 | 1, turnScore: number, events: GameEvent[]) {
  const actor = state.players[actorIndex];
  if (turnScore >= 5) { const finisher = finisherDamage(actor.characterId, turnScore); if (finisher === 'INSTANT') damage(state, actorIndex, 300, false, events); else damage(state, actorIndex, finisher, false, events); forceAwaken(state, opponentIndex(actorIndex), events); }
  else if (turnScore > 0) { actor.hp = clamp(actor.hp + turnScore * 10); events.push({ type: 'SCORE_HEAL', actorUid: actor.uid, amount: turnScore * 10, message: `役で${turnScore * 10}回復` }); }
  checkHpEnd(state, events); if (state.status === 'FINISHED') return;
  if (state.players.every((p) => p.hand.length === 0)) { redealRound(state, events); return; }
  state.activePlayerIndex = opponentIndex(actorIndex); state.turnNumber++; state.stateVersion++; state.phase = 'PLAY_CARD'; state.turnStartScore = state.players[state.activePlayerIndex].score; state.deadlineMs = Date.now() + DAY; delete state.pendingChoice; delete state.pendingAwakeningPlayer;
  const next = state.players[state.activePlayerIndex];
  if (next.hand.length === 0) {
    events.push({ type: 'AUTO_PASS', actorUid: next.uid, message: '手札がないため、この手番を自動でパス' });
    state.activePlayerIndex = opponentIndex(state.activePlayerIndex); state.turnNumber++; state.stateVersion++; state.turnStartScore = state.players[state.activePlayerIndex].score; state.deadlineMs = Date.now() + DAY;
  }
}
function redealRound(state: GameState, events: GameEvent[]) {
  const dealt = dealRound(`${state.rngState}:round:${state.turnNumber}:${state.rngCounter++}`);
  state.deck = dealt.deck; state.field = dealt.field;
  state.players = state.players.map((player, index) => ({ ...player, hand: dealt.hands[index]!, captured: [], yaku: [], score: 0, statuses: {} })) as unknown as [PlayerState, PlayerState];
  state.phase = 'PLAY_CARD'; state.turnNumber++; state.stateVersion++; state.turnStartScore = 0; state.deadlineMs = Date.now() + DAY; delete state.pendingChoice; delete state.pendingAwakeningPlayer;
  events.push({ type: 'ROUND_DRAW', message: '手札切れのため引き分け。HPを維持して再配札' });
}
export function reduceGame(input: GameState, actorUid: string, command: GameCommand): ReduceResult {
  const state = clone(input); const events: GameEvent[] = []; const actorIndex = state.players.findIndex((p) => p.uid === actorUid) as 0 | 1;
  if (actorIndex < 0) throw new Error('参加者ではありません'); if (state.status !== 'ACTIVE') throw new Error('対局は終了しています'); if (actorIndex !== state.activePlayerIndex) throw new Error('手番ではありません');
  const actor = state.players[actorIndex];
  if (command.type === 'PLAY_CARD') { if (state.phase !== 'PLAY_CARD') throw new Error('札を出すフェーズではありません'); const at = actor.hand.indexOf(command.cardId); if (at < 0) throw new Error('その札は手札にありません'); actor.hand.splice(at, 1); events.push({ type: 'PLAY_CARD', actorUid, cardId: command.cardId, message: `${CARD_BY_ID.get(command.cardId)!.name}を出した` }); if (resolveCard(state, actorIndex, command.cardId, 'hand', events)) afterHand(state, actorIndex, events); }
  else if (command.type === 'CHOOSE_MATCH') { if (!state.pendingChoice || !state.pendingChoice.options.includes(command.matchedCardId)) throw new Error('選択できない場札です'); const pending = state.pendingChoice; delete state.pendingChoice; capture(state, actorIndex, pending.playedCardId, [command.matchedCardId], events); if (pending.source === 'hand') afterHand(state, actorIndex, events); else finishTurn(state, actorIndex, events); }
  state.eventLog = [...state.eventLog, ...events].slice(-100); assertInvariants(state); return { state, events };
}
export function forfeitGame(input: GameState, uid: string): GameState { const state = clone(input); const index = state.players.findIndex((p) => p.uid === uid); if (index < 0 || state.status !== 'ACTIVE') throw new Error('投了できません'); state.players[index]!.hp = 0; state.status = 'FINISHED'; state.phase = 'FINISHED'; state.winnerUid = state.players[index === 0 ? 1 : 0].uid; state.finishReason = 'FORFEIT'; return state; }
export function timeoutGame(input: GameState, now = Date.now()): GameState { if (input.status !== 'ACTIVE' || now <= input.deadlineMs) throw new Error('期限前です'); const state = clone(input); const loser = state.activePlayerIndex; state.players[loser].hp = 0; state.status = 'FINISHED'; state.phase = 'FINISHED'; state.winnerUid = state.players[opponentIndex(loser)].uid; state.finishReason = 'TIMEOUT'; return state; }
export function assertInvariants(state: GameState): void { const all = [...state.field, ...state.deck, ...state.players.flatMap((p) => [...p.hand, ...p.captured]), ...(state.pendingChoice ? [state.pendingChoice.playedCardId] : [])]; if (all.length !== 48 || new Set(all).size !== 48) throw new Error('カード不変条件違反'); if (state.players.some((p) => p.hp < 0 || p.hp > 300)) throw new Error('HP不変条件違反'); }
