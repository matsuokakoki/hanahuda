import { useState } from 'react';
import type { MatchView } from '../model';
interface Props { match: MatchView; uid: string; busy: boolean; onReady: (ready: boolean) => void; onStart: () => void; onLeave: () => void }
export function Lobby({ match, uid, busy, onReady, onStart, onLeave }: Props) {
  const [copied, setCopied] = useState(false);
  const mine = Boolean(match.ready?.[uid]);
  const canStart = match.ownerUid === uid && match.participantUids.length === 2 && match.participantUids.every((id) => match.ready?.[id]);
  const copyCode = async () => { await navigator.clipboard.writeText(match.roomCode); setCopied(true); };
  return <main className="panel lobby" data-testid="lobby"><p className="eyebrow">招待コード</p><div className="invite"><strong data-testid="room-code">{match.roomCode}</strong><button type="button" onClick={copyCode}>{copied ? 'コピー済み' : 'コピー'}</button></div><p className="hint">友達にこの6文字と、このページのURLを送ってください。</p><section className="slots" aria-label="参加者"><h2>対戦者</h2>{[0, 1].map((slot) => { const playerUid = match.participantUids[slot]; return <div className="slot" key={slot}><span>{playerUid ? (playerUid === uid ? 'あなた' : '友達') : '参加待ち…'}</span><span className={playerUid && match.ready?.[playerUid] ? 'ready' : ''}>{playerUid ? (match.ready?.[playerUid] ? '準備完了' : '準備中') : '空席'}</span></div>; })}</section><div className="actions"><button className="primary" type="button" disabled={busy} onClick={() => onReady(!mine)} data-testid="ready-button">{mine ? '準備を取り消す' : '準備完了'}</button>{match.ownerUid === uid ? <button className="gold" type="button" disabled={busy || !canStart} onClick={onStart} data-testid="start-button">対局開始</button> : <p>作成者の開始を待っています</p>}<button className="text-button" type="button" onClick={onLeave}>退出</button></div></main>;
}
