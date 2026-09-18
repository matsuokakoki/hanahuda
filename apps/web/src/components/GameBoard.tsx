import { useEffect, useState } from 'react';
import { CARD_BY_ID } from '@extreme-hanafuda/game-core/cards';
import { calculateYaku } from '@extreme-hanafuda/game-core/yaku';
import { finisherDamage, tacticEffects } from '@extreme-hanafuda/game-core/characters';
import type { MatchEvent, MatchView, PrivateView, PublicPlayer } from '../model';
import { CardView } from './CardView';
import { CharacterDetail } from './CharacterDetail';

interface Props { match: MatchView; privateView: PrivateView | null; reviewEvents: MatchEvent[]; uid: string; busy: boolean; onPlay: (cardId: string) => void; onMatch: (cardId: string) => void; onRematch: () => void; onForfeit: () => void; onTimeout: () => void }
const yakuPoints = (yakus: { points: number }[]) => yakus.reduce((sum, yaku) => sum + yaku.points, 0);
const defenseAdjustment = (damage: number, opponent: PublicPlayer) => opponent.characterId === 'hojo_ujiyasu' && opponent.awakened ? Math.max(0, damage - 20) : damage;
function captureSortKey(id: string): number {
  const tags = CARD_BY_ID.get(id)?.yakuTags ?? [];
  if (tags.includes('bright')) return 0;
  if (tags.some((tag) => ['boar', 'deer', 'butterfly', 'cherry', 'moon', 'sake'].includes(tag))) return 1;
  if (tags.includes('poetry') || tags.includes('blue')) return 2;
  if (tags.includes('animal')) return 3;
  if (tags.includes('ribbon')) return 4;
  return 5;
}
const sortedCaptured = (ids: string[]) => [...ids].sort((a, b) => captureSortKey(a) - captureSortKey(b) || (CARD_BY_ID.get(a)?.month ?? 0) - (CARD_BY_ID.get(b)?.month ?? 0));

function directDamageHint(cardId: string, actor: PublicPlayer, opponent: PublicPlayer): string {
  const card = CARD_BY_ID.get(cardId);
  if (!card) return '';
  const effects = tacticEffects(actor.characterId as Parameters<typeof tacticEffects>[0], actor.awakened, card.month);
  const notes = effects.flatMap((effect) => {
    if (effect.type === 'DAMAGE') return [`相手に${defenseAdjustment(effect.amount, opponent)}ダメージ`];
    if (effect.type === 'COIN') {
      const heads = defenseAdjustment(effect.heads, opponent);
      if (effect.tailsSelfDamage > 0) return [`コイン表なら相手に${heads}ダメージ（裏は自分に${effect.tailsSelfDamage}ダメージ）`];
      return [`コイン表なら相手に${heads}ダメージ、裏なら相手に${defenseAdjustment(-effect.tailsSelfDamage, opponent)}ダメージ`];
    }
    return [];
  });
  if (opponent.characterId === 'hojo_ujiyasu' && opponent.awakened && notes.length) notes.push('北条氏康の覚醒防御を反映済み');
  return notes.length ? notes.join('。') : 'この札による相手への直接ダメージはありません';
}

function handHint(cardId: string, actor: PublicPlayer, opponent: PublicPlayer, field: string[]): string {
  const card = CARD_BY_ID.get(cardId);
  if (!card) return '';
  const matches = field.filter((id) => CARD_BY_ID.get(id)?.month === card.month);
  if (matches.length === 0) return '場に同じ月の札がないため、この札は場に置かれます。相手への直接ダメージはありません。';
  const before = calculateYaku(actor.captured);
  const options = matches.length === 2 ? matches.map((id) => [id]) : [matches];
  const directDamage = directDamageHint(cardId, actor, opponent);
  const explanations = options.map((selected) => {
    const after = calculateYaku([...actor.captured, cardId, ...selected]);
    const gained = yakuPoints(after) - yakuPoints(before);
    const increased = after.filter((yaku) => (before.find((old) => old.id === yaku.id)?.points ?? 0) < yaku.points);
    const yakuHint = gained > 0 ? `${increased.map((yaku) => `${yaku.name}${yaku.points}点`).join('・')}（+${gained}点）` : '新しい役はまだありません';
    const turnGain = Math.max(0, yakuPoints(after) - actor.score);
    if (turnGain < 5) return `${yakuHint}。${directDamage}`;
    const finisher = finisherDamage(actor.characterId as Parameters<typeof finisherDamage>[0], turnGain);
    const finisherHint = finisher === 'INSTANT' ? '役の必殺：相手HPを0にする' : `役の必殺：相手に${defenseAdjustment(finisher, opponent)}ダメージ`;
    return `${yakuHint}。${directDamage}。${finisherHint}`;
  });
  return matches.length === 2 ? `どちらを取るかで役が変化：${explanations.join(' / ')}` : `この札を取ると：${explanations[0]}`;
}

function PlayerPanel({ player, me, active, onCharacter }: { player: PublicPlayer; me: boolean; active: boolean; onCharacter: () => void }) {
  return <section className={`fighter${active ? ' fighter--active' : ''}`}><div><p className="eyebrow">{me ? 'あなた' : '対戦相手'} {active ? '・手番' : ''}</p><h2 title={`${player.characterName}の特徴を表示`}>{player.characterName} <button className="character-button" type="button" onClick={onCharacter}>特徴</button></h2><p>{player.awakened ? '覚醒' : '通常'}・役点 {player.score}</p></div><div className="hp"><span>HP</span><strong>{player.hp}</strong><div><i style={{ width: `${player.hp / 3}%` }} /></div></div><p>手札 {player.handCount}枚 / 取得 {player.captured.length}枚</p><p className="yaku">{player.yaku.length ? player.yaku.map((yaku) => `${yaku.name}(${yaku.points})`).join('・') : '成立役なし'}</p></section>;
}

function CapturedCards({ player, label }: { player: PublicPlayer; label: string }) {
  const captured = sortedCaptured(player.captured);
  return <details className="captured"><summary>{label}の取得札を確認（{player.captured.length}枚）</summary><p className="hint">役を狙いやすい順：光 → 猪鹿蝶・酒 → 赤短・青短 → タネ → 短冊 → カス</p><div className="cards captured-cards">{captured.length ? captured.map((id) => <CardView key={id} cardId={id}/>) : <p className="hint">まだ札を取っていません。</p>}</div></details>;
}

function ActionFeedback({ events, uid }: { events: MatchEvent[]; uid: string }) {
  const [feedback, setFeedback] = useState<{ coin: string | null; changes: { label: string; amount: number }[] } | null>(null);
  useEffect(() => {
    const latest = events.at(-1);
    if (!latest) return;
    const coin = latest.events.find((event) => event.type === 'COIN')?.message ?? null;
    const changes = latest.events.flatMap((event) => {
      if (event.amount === undefined) return [];
      if (event.type === 'DAMAGE') return [{ label: event.actorUid === uid ? '相手' : 'あなた', amount: -event.amount }];
      if (event.type === 'SELF_DAMAGE') return [{ label: event.actorUid === uid ? 'あなた' : '相手', amount: -event.amount }];
      if (event.type === 'HEAL' || event.type === 'SCORE_HEAL') return [{ label: event.actorUid === uid ? 'あなた' : '相手', amount: event.amount }];
      return [];
    });
    if (!coin && !changes.length) return;
    // The event stream is an external subscription; mirror its latest event into the animation state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFeedback({ coin, changes });
    const timeout = window.setTimeout(() => setFeedback(null), coin ? 1800 : 1300);
    return () => window.clearTimeout(timeout);
  }, [events, uid]);
  if (!feedback) return null;
  return <section className="action-feedback" aria-live="polite">{feedback.coin ? <div className="coin-feedback"><span className="coin coin--flip">🪙</span><strong>コインを投げています…</strong><span>{feedback.coin}</span></div> : null}{feedback.changes.map((change, index) => <span className={`hp-change ${change.amount < 0 ? 'hp-change--damage' : 'hp-change--heal'}`} key={`${change.label}-${index}`}>{change.label} {change.amount > 0 ? '+' : ''}{change.amount} HP</span>)}</section>;
}

function ReviewBoard({ entries, uid }: { entries: MatchEvent[]; uid: string }) {
  const allEntries = entries.filter((entry) => entry.review);
  let startIndex = -1;
  for (let index = allEntries.length - 1; index >= 0; index -= 1) { if (allEntries[index]!.events.some((event) => event.type === 'START')) { startIndex = index; break; } }
  const usableEntries = startIndex >= 0 ? allEntries.slice(startIndex) : allEntries;
  const [step, setStep] = useState(0);
  // Keep the review cursor on the latest recorded turn as new snapshots arrive.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setStep(Math.max(0, usableEntries.length - 1)); }, [usableEntries.length]);
  if (!usableEntries.length) return <section className="review panel"><h2>感想戦</h2><p>この対局は記録の追加前に始まったため、手ごとの記録はありません。</p></section>;
  const entry = usableEntries[step]!;
  const snapshot = entry.review!;
  const previous = usableEntries[step - 1]?.review;
  const me = snapshot.players.find((player) => player.uid === uid);
  const opponent = snapshot.players.find((player) => player.uid !== uid);
  const scoreDelta = (player: PublicPlayer | undefined) => player ? player.score - (previous?.players.find((old) => old.uid === player.uid)?.score ?? 0) : 0;
  return <section className="review panel" data-testid="review-board"><p className="eyebrow">感想戦</p><h2>局面を一手ずつ振り返る</h2><div className="review-controls"><button type="button" disabled={step === 0} onClick={() => setStep((current) => current - 1)}>前へ</button><strong>{step + 1} / {usableEntries.length}</strong><button type="button" disabled={step === usableEntries.length - 1} onClick={() => setStep((current) => current + 1)}>次へ</button></div><p>ターン {snapshot.turnNumber}・{snapshot.activePlayerUid === uid ? 'あなたの手番になる局面' : '相手の手番になる局面'}</p><div className="review-score"><span>あなた：役点 {me?.score ?? 0} {scoreDelta(me) ? `（${scoreDelta(me) > 0 ? '+' : ''}${scoreDelta(me)}）` : ''} / HP {me?.hp ?? 0}</span><span>相手：役点 {opponent?.score ?? 0} {scoreDelta(opponent) ? `（${scoreDelta(opponent) > 0 ? '+' : ''}${scoreDelta(opponent)}）` : ''} / HP {opponent?.hp ?? 0}</span></div><h3>この局面で起きたこと</h3><ul className="review-events">{entry.events.map((event, index) => <li key={`${event.type}-${index}`}>{event.cardId ? `${CARD_BY_ID.get(event.cardId)?.name ?? event.cardId}：` : ''}{event.message}</li>)}</ul><h3>場札（山札 {snapshot.deckCount}枚）</h3><div className="cards review-cards">{snapshot.field.map((id) => <CardView key={id} cardId={id}/>)}</div><div className="review-captures"><CapturedCards player={opponent!} label="相手"/><CapturedCards player={me!} label="あなた"/></div></section>;
}

export function GameBoard({ match, privateView, reviewEvents, uid, busy, onPlay, onMatch, onRematch, onForfeit, onTimeout }: Props) {
  const [now, setNow] = useState<number | null>(null);
  const [characterId, setCharacterId] = useState<string | null>(null);
  useEffect(() => { const tick = () => setNow(Date.now()); const kickoff = window.setTimeout(tick, 0); const id = window.setInterval(tick, 1000); return () => { window.clearTimeout(kickoff); window.clearInterval(id); }; }, []);
  const players = match.players ?? [];
  const me = players.find((player) => player.uid === uid);
  const opponent = players.find((player) => player.uid !== uid);
  const isTurn = match.activePlayerUid === uid;
  const finished = match.status === 'FINISHED';
  const remaining = now === null ? 60 : Math.max(0, Math.ceil(((match.deadlineMs ?? now) - now) / 1000));
  if (!me || !opponent) return <p>ゲーム状態を同期中…</p>;
  const canPlay = !finished && isTurn && match.phase === 'PLAY_CARD' && !busy;
  const choices = new Set(privateView?.pendingChoice?.options ?? []);
  const field = match.field ?? [];
  const detailPlayer = players.find((player) => player.characterId === characterId);
  return <main className="game" data-testid="game-board"><ActionFeedback events={reviewEvents} uid={uid}/>{characterId && detailPlayer ? <CharacterDetail characterId={characterId} awakened={detailPlayer.awakened} onClose={() => setCharacterId(null)}/> : null}{finished ? <><section className="panel result" data-testid="finished"><button className="primary large rematch-button" type="button" onClick={onRematch} disabled={busy}>次の試合へ</button><p className="eyebrow">対局終了</p><h1>{match.winnerUid === null ? '引き分け' : match.winnerUid === uid ? '勝利' : '敗北'}</h1><p>理由: {match.finishReason}</p><div className="final-hp"><span>あなた {me.hp} HP</span><span>相手 {opponent.hp} HP</span></div></section><ReviewBoard entries={reviewEvents} uid={uid}/></> : <div className="turnbar"><strong>{isTurn ? 'あなたの手番' : '相手の手番'}</strong><span>ターン {match.turnNumber}・残り {remaining}秒</span><span data-testid="state-version">v{match.stateVersion}</span></div>}<PlayerPanel player={opponent} me={false} active={!finished && !isTurn} onCharacter={() => setCharacterId(opponent.characterId)}/><section><h2>相手の手札 <small>{opponent.handCount}枚</small></h2><p className="hint">この対戦ではオープンハンド。相手の札も確認できます。</p><div className="cards hand opponent-hand">{(opponent.hand ?? []).map((id) => <CardView key={id} cardId={id} disabled/>)}</div></section><CapturedCards player={opponent} label="相手"/><section><h2>場札 <small>山札 {match.deckCount}枚</small></h2><div className="cards field">{field.map((id) => <CardView key={id} cardId={id} onClick={choices.has(id) && !busy ? () => onMatch(id) : undefined} selected={choices.has(id)} testId={choices.has(id) ? `match-${id}` : undefined}/>)}</div></section><PlayerPanel player={me} me active={!finished && isTurn} onCharacter={() => setCharacterId(me.characterId)}/><CapturedCards player={me} label="あなた"/><section><h2>あなたの手札</h2><p className="hint">縁取りされた「取れる」札は場の同月札と組にできます。札にマウスを重ねると、役・直接ダメージ・必殺の見込みを確認できます。</p><div className="cards hand">{(privateView?.hand ?? []).length ? <div className="cards hand">{(privateView?.hand ?? []).map((id) => { const month = CARD_BY_ID.get(id)?.month; const matchCount = field.filter((fieldId) => CARD_BY_ID.get(fieldId)?.month === month).length; return <CardView key={id} cardId={id} matchCount={matchCount} hint={handHint(id, me, opponent, field)} disabled={!canPlay} onClick={canPlay ? () => onPlay(id) : undefined} testId={`hand-${id}`}/>; })}</div> : <p className="hint">手札はありません。自動処理または相手の手番を待っています。</p>}</div></section><div className="danger-actions"><button type="button" onClick={onTimeout} disabled={finished || busy || remaining > 0}>時間切れを申告</button><button type="button" onClick={onForfeit} disabled={finished || busy}>投了する</button></div></main>;
}
