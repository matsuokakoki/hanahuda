import { CARD_BY_ID } from './cards.js';
import type { Yaku } from './types.js';

export function calculateYaku(captured: string[]): Yaku[] {
  const cards = captured.map((id) => CARD_BY_ID.get(id)).filter((c) => c !== undefined);
  const tags = (tag: string) => cards.filter((card) => card.yakuTags.includes(tag));
  const has = (tag: string) => tags(tag).length > 0;
  const result: Yaku[] = [];
  const brights = tags('bright');
  const rain = has('rain');
  if (brights.length === 5) result.push({ id: 'five_brights', name: '五光', points: 10 });
  else if (brights.length === 4) result.push({ id: rain ? 'rainy_four_brights' : 'four_brights', name: rain ? '雨四光' : '四光', points: rain ? 7 : 8 });
  else if (brights.length === 3 && !rain) result.push({ id: 'three_brights', name: '三光', points: 5 });
  if (has('boar') && has('deer') && has('butterfly')) result.push({ id: 'boar_deer_butterflies', name: '猪鹿蝶', points: 5 });
  if (tags('poetry').length === 3) result.push({ id: 'poetry_ribbons', name: '赤短', points: 5 });
  if (tags('blue').length === 3) result.push({ id: 'blue_ribbons', name: '青短', points: 5 });
  if (has('cherry') && has('sake')) result.push({ id: 'cherry_viewing', name: '花見酒', points: 5 });
  if (has('moon') && has('sake')) result.push({ id: 'moon_viewing', name: '月見酒', points: 5 });
  for (const [tag, threshold, id, name] of [['animal', 5, 'animals', 'タネ'], ['ribbon', 5, 'ribbons', '短冊'], ['chaff', 10, 'chaff', 'カス']] as const) {
    const count = tags(tag).length;
    if (count >= threshold) result.push({ id, name, points: count - threshold + 1 });
  }
  return result;
}
export const totalScore = (captured: string[]) => calculateYaku(captured).reduce((sum, yaku) => sum + yaku.points, 0);
