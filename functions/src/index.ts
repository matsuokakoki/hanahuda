import { randomBytes } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { z } from 'zod';
import { CHARACTER_BY_ID, forfeitGame, initializeGame, reduceGame, timeoutGame, type GameCommand, type GameState } from '@extreme-hanafuda/game-core';

initializeApp();
const db = getFirestore();
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'demo-extreme-hanafuda';
const callableOptions = { region: 'asia-northeast1', cors: true, enforceAppCheck: false } as const;
const matchIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);
const codeSchema = z.string().trim().toUpperCase().regex(/^[A-Z2-9]{6}$/);
const commandIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);
const emptySchema = z.object({}).strict();
const matchSchema = z.object({ matchId: matchIdSchema }).strict();

function authUid(request: { auth?: { uid: string } | null }): string {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', '匿名認証が必要です');
  return request.auth.uid;
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value ?? {});
  if (!result.success) throw new HttpsError('invalid-argument', result.error.issues.map((issue) => issue.message).join(', '));
  return result.data;
}
function code(): string { const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from(randomBytes(6), (byte) => alphabet[byte % alphabet.length]).join(''); }
function publicPlayer(player: GameState['players'][number]) { const character = CHARACTER_BY_ID.get(player.characterId)!; return { uid: player.uid, hp: player.hp, handCount: player.hand.length, hand: player.hand, captured: player.captured, characterId: player.characterId, characterName: player.awakened ? character.awakenedName : character.normalName, awakened: player.awakened, yaku: player.yaku, score: player.score }; }
function publicGame(state: GameState) { return { status: state.status, phase: state.phase, players: state.players.map(publicPlayer), activePlayerUid: state.players[state.activePlayerIndex].uid, field: state.field, deckCount: state.deck.length, stateVersion: state.stateVersion, turnNumber: state.turnNumber, deadlineMs: state.deadlineMs, winnerUid: state.winnerUid, finishReason: state.finishReason }; }
function privateGame(state: GameState, index: 0 | 1) { const player = state.players[index]; return { hand: player.hand, pendingChoice: state.activePlayerIndex === index ? (state.pendingChoice ?? null) : null }; }
function writeGame(tx: FirebaseFirestore.Transaction, matchRef: FirebaseFirestore.DocumentReference, state: GameState, eventId: string, events: unknown[]) {
  tx.set(matchRef, { ...publicGame(state), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  tx.set(matchRef.collection('server').doc('state'), state);
  state.players.forEach((player, index) => tx.set(matchRef.collection('private').doc(player.uid), privateGame(state, index as 0 | 1)));
  tx.set(matchRef.collection('events').doc(eventId), { events, review: publicGame(state), stateVersion: state.stateVersion, createdAt: FieldValue.serverTimestamp() });
}
function mapError(error: unknown): never { if (error instanceof HttpsError) throw error; const message = error instanceof Error ? error.message : '処理に失敗しました'; logger.warn(message); throw new HttpsError('failed-precondition', message); }
function canonical(value: unknown): string { if (value === undefined) throw new HttpsError('invalid-argument', 'undefinedは使えません'); if (value === null || typeof value !== 'object') return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`; return `{${Object.keys(value as object).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`; }

export const createMatch = onCall(callableOptions, async (request) => {
  const uid = authUid(request); parse(emptySchema, request.data); const matchRef = db.collection('matches').doc(); const roomCode = code();
  await db.runTransaction(async (tx) => { const codeRef = db.collection('roomCodes').doc(roomCode); const existing = await tx.get(codeRef); if (existing.exists) throw new HttpsError('already-exists', '招待コードが衝突しました。再度お試しください'); tx.create(matchRef, { participantUids: [uid], ownerUid: uid, roomCode, status: 'LOBBY', ready: { [uid]: false }, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }); tx.create(codeRef, { matchId: matchRef.id }); });
  return { matchId: matchRef.id, roomCode, projectId: PROJECT_ID };
});

export const joinMatch = onCall(callableOptions, async (request) => {
  const uid = authUid(request); const { roomCode } = parse(z.object({ roomCode: codeSchema }).strict(), request.data);
  return db.runTransaction(async (tx) => { const codeRef = db.collection('roomCodes').doc(roomCode); const codeSnap = await tx.get(codeRef); if (!codeSnap.exists) throw new HttpsError('not-found', '部屋が見つかりません'); const matchRef = db.collection('matches').doc(codeSnap.get('matchId')); const matchSnap = await tx.get(matchRef); if (!matchSnap.exists || matchSnap.get('status') !== 'LOBBY') throw new HttpsError('failed-precondition', '参加できない部屋です'); const participants = matchSnap.get('participantUids') as string[]; if (!participants.includes(uid) && participants.length >= 2) throw new HttpsError('resource-exhausted', '部屋は満員です'); const next = participants.includes(uid) ? participants : [...participants, uid]; tx.update(matchRef, { participantUids: next, [`ready.${uid}`]: false, updatedAt: FieldValue.serverTimestamp() }); return { matchId: matchRef.id }; });
});

export const setReady = onCall(callableOptions, async (request) => {
  const uid = authUid(request); const { matchId, ready } = parse(z.object({ matchId: matchIdSchema, ready: z.boolean() }).strict(), request.data); const ref = db.collection('matches').doc(matchId);
  await db.runTransaction(async (tx) => { const snap = await tx.get(ref); if (!snap.exists || !(snap.get('participantUids') as string[]).includes(uid)) throw new HttpsError('permission-denied', '参加者ではありません'); if (snap.get('status') !== 'LOBBY') throw new HttpsError('failed-precondition', 'ロビーではありません'); tx.update(ref, { [`ready.${uid}`]: ready, updatedAt: FieldValue.serverTimestamp() }); }); return { ready };
});

export const startMatch = onCall(callableOptions, async (request) => {
  const uid = authUid(request); const { matchId } = parse(matchSchema, request.data); const ref = db.collection('matches').doc(matchId);
  return db.runTransaction(async (tx) => { const snap = await tx.get(ref); if (!snap.exists) throw new HttpsError('not-found', '部屋がありません'); if (snap.get('status') !== 'LOBBY') throw new HttpsError('failed-precondition', '開始済みです'); const participants = snap.get('participantUids') as string[]; if (snap.get('ownerUid') !== uid) throw new HttpsError('permission-denied', '作成者だけが開始できます'); const ready = snap.get('ready') as Record<string, boolean>; if (participants.length !== 2 || !participants.every((id) => ready[id])) throw new HttpsError('failed-precondition', '2人とも準備完了してください'); const state = initializeGame(participants as [string, string], randomBytes(32).toString('hex')); writeGame(tx, ref, state, `start-${Date.now()}`, [{ type: 'START', message: '対局開始' }]); return { stateVersion: state.stateVersion }; });
});

const commandSchema = z.object({
  matchId: matchIdSchema, commandId: commandIdSchema, expectedStateVersion: z.number().int().nonnegative(),
  type: z.enum(['PLAY_CARD', 'CHOOSE_MATCH']),
  payload: z.object({ cardId: z.string().regex(/^([1-9]|1[0-2])-[1-4]$/).optional(), matchedCardId: z.string().regex(/^([1-9]|1[0-2])-[1-4]$/).optional() }).strict()
}).strict();
export const submitGameCommand = onCall(callableOptions, async (request) => {
  const uid = authUid(request); const data = parse(commandSchema, request.data); const commandResultRef = db.collection('commandResults').doc(`${data.matchId}_${uid}_${data.commandId}`); const matchRef = db.collection('matches').doc(data.matchId); const payloadHash = canonical(data);
  return db.runTransaction(async (tx) => { try { const [existing, matchSnap, stateSnap] = await Promise.all([tx.get(commandResultRef), tx.get(matchRef), tx.get(matchRef.collection('server').doc('state'))]); if (existing.exists) { if (existing.get('payloadHash') !== payloadHash) throw new HttpsError('already-exists', '同じcommandIdに異なる内容が指定されました'); return existing.get('result'); } if (!matchSnap.exists || !(matchSnap.get('participantUids') as string[]).includes(uid)) throw new HttpsError('permission-denied', '参加者ではありません'); if (!stateSnap.exists) throw new HttpsError('failed-precondition', 'ゲーム状態がありません'); const state = stateSnap.data() as GameState; if (state.stateVersion !== data.expectedStateVersion) throw new HttpsError('aborted', 'stateVersionが古いため再読込してください'); let command: GameCommand; if (data.type === 'PLAY_CARD' && data.payload.cardId) command = { type: 'PLAY_CARD', cardId: data.payload.cardId }; else if (data.type === 'CHOOSE_MATCH' && data.payload.matchedCardId) command = { type: 'CHOOSE_MATCH', matchedCardId: data.payload.matchedCardId }; else throw new HttpsError('invalid-argument', 'command payloadが不正です'); const reduced = reduceGame(state, uid, command); const result = { stateVersion: reduced.state.stateVersion, status: reduced.state.status }; writeGame(tx, matchRef, reduced.state, data.commandId, reduced.events); tx.create(commandResultRef, { payloadHash, result, createdAt: FieldValue.serverTimestamp() }); return result; } catch (error) { return mapError(error); } });
});

export const forfeitMatch = onCall(callableOptions, async (request) => {
  const uid = authUid(request); const { matchId } = parse(matchSchema, request.data); const ref = db.collection('matches').doc(matchId);
  return db.runTransaction(async (tx) => { const [matchSnap, stateSnap] = await Promise.all([tx.get(ref), tx.get(ref.collection('server').doc('state'))]); if (!matchSnap.exists || !(matchSnap.get('participantUids') as string[]).includes(uid)) throw new HttpsError('permission-denied', '参加者ではありません'); const state = forfeitGame(stateSnap.data() as GameState, uid); writeGame(tx, ref, state, `forfeit-${Date.now()}`, [{ type: 'FORFEIT', actorUid: uid, message: '投了' }]); return { winnerUid: state.winnerUid }; });
});

export const claimTimeout = onCall(callableOptions, async (request) => {
  const uid = authUid(request); const { matchId } = parse(matchSchema, request.data); const ref = db.collection('matches').doc(matchId);
  return db.runTransaction(async (tx) => { const [matchSnap, stateSnap] = await Promise.all([tx.get(ref), tx.get(ref.collection('server').doc('state'))]); if (!matchSnap.exists || !(matchSnap.get('participantUids') as string[]).includes(uid)) throw new HttpsError('permission-denied', '参加者ではありません'); const state = timeoutGame(stateSnap.data() as GameState); writeGame(tx, ref, state, `timeout-${Date.now()}`, [{ type: 'TIMEOUT', message: '時間切れ' }]); return { winnerUid: state.winnerUid }; });
});

export const rematchMatch = onCall(callableOptions, async (request) => {
  const uid = authUid(request); const { matchId } = parse(matchSchema, request.data); const ref = db.collection('matches').doc(matchId);
  return db.runTransaction(async (tx) => { const snap = await tx.get(ref); if (!snap.exists) throw new HttpsError('not-found', '部屋がありません'); const participants = snap.get('participantUids') as string[]; if (!participants.includes(uid)) throw new HttpsError('permission-denied', '参加者ではありません'); if (snap.get('status') !== 'FINISHED') throw new HttpsError('failed-precondition', '前の対局がまだ終了していません'); if (participants.length !== 2) throw new HttpsError('failed-precondition', '2人の参加者が必要です'); const state = initializeGame(participants as [string, string], randomBytes(32).toString('hex')); writeGame(tx, ref, state, `rematch-${Date.now()}-${uid.slice(0, 6)}`, [{ type: 'START', actorUid: uid, message: '次の試合を開始' }]); return { stateVersion: state.stateVersion, status: state.status }; });
});
