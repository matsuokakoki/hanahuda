import type { Card } from './types.js';

const monthNames = ['松', '梅', '桜', '藤', '杜若', '牡丹', '萩', '芒', '菊', '紅葉', '柳', '桐'];
const special: Record<string, Omit<Card, 'id' | 'month'>> = {
  '1-1': { name: '松に鶴', category: 'bright', yakuTags: ['bright'] },
  '1-2': { name: '松の赤短', category: 'ribbon', yakuTags: ['ribbon', 'poetry'] },
  '2-1': { name: '梅に鶯', category: 'animal', yakuTags: ['animal'] },
  '2-2': { name: '梅の赤短', category: 'ribbon', yakuTags: ['ribbon', 'poetry'] },
  '3-1': { name: '桜に幕', category: 'bright', yakuTags: ['bright', 'cherry'] },
  '3-2': { name: '桜の赤短', category: 'ribbon', yakuTags: ['ribbon', 'poetry'] },
  '4-1': { name: '藤に不如帰', category: 'animal', yakuTags: ['animal'] },
  '4-2': { name: '藤の短冊', category: 'ribbon', yakuTags: ['ribbon'] },
  '5-1': { name: '杜若に八橋', category: 'animal', yakuTags: ['animal'] },
  '5-2': { name: '杜若の短冊', category: 'ribbon', yakuTags: ['ribbon'] },
  '6-1': { name: '牡丹に蝶', category: 'animal', yakuTags: ['animal', 'butterfly'] },
  '6-2': { name: '牡丹の青短', category: 'ribbon', yakuTags: ['ribbon', 'blue'] },
  '7-1': { name: '萩に猪', category: 'animal', yakuTags: ['animal', 'boar'] },
  '7-2': { name: '萩の短冊', category: 'ribbon', yakuTags: ['ribbon'] },
  '8-1': { name: '芒に月', category: 'bright', yakuTags: ['bright', 'moon'] },
  '8-2': { name: '芒に雁', category: 'animal', yakuTags: ['animal'] },
  '9-1': { name: '菊に盃', category: 'animal', yakuTags: ['animal', 'chaff', 'sake'] },
  '9-2': { name: '菊の青短', category: 'ribbon', yakuTags: ['ribbon', 'blue'] },
  '10-1': { name: '紅葉に鹿', category: 'animal', yakuTags: ['animal', 'deer'] },
  '10-2': { name: '紅葉の青短', category: 'ribbon', yakuTags: ['ribbon', 'blue'] },
  '11-1': { name: '柳に小野道風', category: 'bright', yakuTags: ['bright', 'rain'] },
  '11-2': { name: '柳に燕', category: 'animal', yakuTags: ['animal'] },
  '11-3': { name: '柳の短冊', category: 'ribbon', yakuTags: ['ribbon'] },
  '12-1': { name: '桐に鳳凰', category: 'bright', yakuTags: ['bright'] }
};

export const CARDS: Card[] = Array.from({ length: 12 }, (_, monthIndex) =>
  Array.from({ length: 4 }, (_, cardIndex): Card => {
    const month = monthIndex + 1;
    const id = `${month}-${cardIndex + 1}`;
    return { id, month, ...(special[id] ?? { name: `${monthNames[monthIndex]}のカス${cardIndex + 1}`, category: 'chaff', yakuTags: ['chaff'] }) };
  })
).flat();
export const CARD_BY_ID = new Map(CARDS.map((card) => [card.id, card]));
