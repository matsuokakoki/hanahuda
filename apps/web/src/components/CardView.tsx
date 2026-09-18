import { CARD_BY_ID } from '@extreme-hanafuda/game-core/cards';
interface Props { cardId: string; onClick?: () => void; selected?: boolean; disabled?: boolean; testId?: string; matchCount?: number; hint?: string }
export function CardView({ cardId, onClick, selected = false, disabled = false, testId, matchCount = 0, hint }: Props) {
  const card = CARD_BY_ID.get(cardId);
  if (!card) return null;
  const kind = card.category === 'bright' ? '光' : card.category === 'animal' ? '種' : card.category === 'ribbon' ? '短' : 'カス';
  const matchLabel = matchCount === 1 ? '取れる' : matchCount === 2 ? '選んで取る' : matchCount === 3 ? '全部取れる' : '';
  return <button type="button" title={hint} className={`card card--${card.category}${selected ? ' card--selected' : ''}${matchCount ? ' card--match' : ''}`} onClick={onClick} disabled={disabled || !onClick} data-testid={testId} aria-label={`${card.name} ${card.month}月${hint ? `。${hint}` : ''}`}><span className="card__month">{card.month}月</span>{matchLabel ? <span className="card__match">{matchLabel}</span> : null}<span className="card__name">{card.name}</span><span className="card__kind">{kind}</span>{hint ? <span className="card__hint">{hint}</span> : null}</button>;
}
