import { CHARACTER_BY_ID, CHARACTER_DETAILS, describeMonthlyTactic } from '@extreme-hanafuda/game-core/characters';
import type { CharacterId } from '@extreme-hanafuda/game-core';

interface Props { characterId: string; awakened: boolean; onClose: () => void }
export function CharacterDetail({ characterId, awakened, onClose }: Props) {
  const character = CHARACTER_BY_ID.get(characterId as CharacterId);
  if (!character) return null;
  const detail = CHARACTER_DETAILS[character.id];
  return <div className="modal-backdrop" role="presentation" onClick={onClose}><section className="character-modal" role="dialog" aria-modal="true" aria-labelledby="character-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" type="button" onClick={onClose} aria-label="閉じる">×</button><p className="eyebrow">{character.army}軍・{character.month}月の武将</p><h2 id="character-title">{awakened ? character.awakenedName : character.normalName}</h2><p><strong>通常:</strong> {detail.normal}</p><p><strong>覚醒:</strong> {detail.awakened}</p><p><strong>特徴:</strong> {detail.passive}</p><p className="hint">HPが100未満になると自動で覚醒します。5点以上の役は必殺を発動します。</p><h3>月ごとの札を取ったときの効果</h3><div className="month-details"><p className="month-details__head"><strong>月</strong><span>通常</span><span>覚醒</span></p>{Array.from({ length: 12 }, (_, index) => { const month = index + 1; return <p key={month}><strong>{month}月</strong><span>{describeMonthlyTactic(character.id, false, month)}</span><span>{describeMonthlyTactic(character.id, true, month)}</span></p>; })}</div></section></div>;
}
