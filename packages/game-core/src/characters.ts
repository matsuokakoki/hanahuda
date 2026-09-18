import type { Character, CharacterId, Effect } from './types.js';

export const CHARACTERS: Character[] = [
  ['date_masamune', 1, '伊達政宗', '独眼竜', 'DATE'], ['maeda_keiji', 2, '前田慶次', '前田慶次', 'UESUGI'],
  ['mori_motonari', 3, '毛利元就', '毛利元就', 'MORI'], ['sanada_yukimura', 4, '真田幸村', '真田幸村', 'TAKEDA'],
  ['tokugawa_ieyasu', 5, '徳川家康', '徳川家康', 'TOKUGAWA'], ['hojo_ujiyasu', 6, '北条氏康', '北条氏康', 'HOJO'],
  ['uesugi_kenshin', 7, '上杉謙信', '越後の龍', 'UESUGI'], ['saika_magoichi', 8, '雑賀孫一', '雑賀孫一', 'HONGANJI'],
  ['takeda_shingen', 9, '武田信玄', '甲斐の虎', 'TAKEDA'], ['oda_nobunaga', 10, '織田信長', '魔王', 'ODA'],
  ['toyotomi_hideyoshi', 11, '豊臣秀吉', '太閤', 'TOYOTOMI'], ['shimazu_yoshihiro', 12, '島津義弘', '鬼島津', 'SHIMAZU']
].map(([id, month, normalName, awakenedName, army]) => ({ id, month, normalName, awakenedName, army, specialEffectId: id })) as Character[];
export const CHARACTER_BY_ID = new Map(CHARACTERS.map((character) => [character.id, character]));
export const CHARACTER_DETAILS: Record<CharacterId, { normal: string; awakened: string; passive: string }> = {
  date_masamune: { normal: '7月・11月の攻撃が強力。', awakened: '騎兵と射撃がさらに強化され、攻め続ける武将。', passive: '騎兵・射撃の攻撃+10。必殺は5点から50。' },
  maeda_keiji: { normal: '8月はコインで大ダメージを狙える。', awakened: '1〜7月の攻撃がコイン勝負になり、一発逆転向き。', passive: '5点以外の奇数点なら必殺が即死攻撃。' },
  mori_motonari: { normal: '9月の射撃が得意。', awakened: '9〜11月の射撃と12月の虚報が強化される。', passive: '射撃+20。覚醒後の虚報には即死の可能性。' },
  sanada_yukimura: { normal: '2月の歩兵攻撃が強い。', awakened: '1〜7月の前線戦が強化される。', passive: '歩兵+10、騎兵+20。徳川相手に強い。' },
  tokugawa_ieyasu: { normal: '3月は攻撃しながら30回復。', awakened: '取得するたびに回復し、相手へ反撃する粘り強い型。', passive: '覚醒後、取得時に自分+10・相手-20。' },
  hojo_ujiyasu: { normal: '4月の回復で通常攻撃を一度防ぐ。', awakened: '守りながら数値攻撃を弱める。', passive: '受ける数値攻撃-20。通常攻撃を一度無効化。' },
  uesugi_kenshin: { normal: '5月の騎兵が強力。', awakened: '多くの月で攻撃が強化される万能型。', passive: 'すべての数値攻撃+20。必殺の伸びが大きい。' },
  saika_magoichi: { normal: '10月の射撃コインで高火力。', awakened: '9〜11月の射撃が強化され、狙い撃ちが危険。', passive: '射撃+20。覚醒後の狙い撃ちに即死の可能性。' },
  takeda_shingen: { normal: '6月の騎兵が強力。', awakened: '5〜7月の騎兵で大ダメージを狙う。', passive: '騎兵+50。必殺の伸びが大きい。' },
  oda_nobunaga: { normal: '11月の射撃90が脅威。', awakened: '多くの月を攻めに変える高火力型。', passive: '歩兵・騎兵+10、射撃+20。' },
  toyotomi_hideyoshi: { normal: '12月に相手の手札を1枚だけ場へ出す。', awakened: '4月の補給が40になり、12月も妨害できる。', passive: '必殺後に山札を1枚追加。補給が強い。' },
  shimazu_yoshihiro: { normal: '1月の歩兵50で先手を取る。', awakened: '1〜3月、9〜11月の攻撃が強化される。', passive: '歩兵・射撃+10。HP0を一度だけ10で耐える。' }
};

const baseDamage = [10, 20, 30, 0, 10, 20, 30, 0, 10, 20, 30, 10];
const attackClass = (month: number) => month <= 4 ? 'infantry' : month <= 8 ? 'cavalry' : 'ranged';
const overrides: Partial<Record<CharacterId, { normal?: Record<number, number>; awakened?: Record<number, number> }>> = {
  date_masamune: { normal: { 7: 50, 11: 50 }, awakened: { 5: 20, 6: 30, 7: 60, 9: 20, 10: 30, 11: 60 } },
  maeda_keiji: { awakened: { 1: 50, 2: 50, 3: 50, 4: 50, 5: 50, 6: 50, 7: 50, 8: 100 } },
  mori_motonari: { normal: { 9: 50 }, awakened: { 9: 70, 10: 40, 11: 50, 12: 30 } },
  sanada_yukimura: { normal: { 2: 50 }, awakened: { 1: 20, 2: 30, 3: 40, 5: 30, 6: 40, 7: 50 } },
  uesugi_kenshin: { normal: { 5: 50 }, awakened: { 1: 30, 2: 40, 3: 50, 5: 70, 6: 40, 7: 50, 9: 30, 10: 40, 11: 50 } },
  saika_magoichi: { awakened: { 9: 30, 11: 50 } }, takeda_shingen: { normal: { 6: 50 }, awakened: { 5: 60, 6: 100, 7: 80 } },
  oda_nobunaga: { normal: { 11: 90 }, awakened: { 1: 20, 2: 30, 3: 40, 5: 20, 6: 30, 7: 40, 9: 30, 10: 40, 11: 110 } },
  shimazu_yoshihiro: { normal: { 1: 50 }, awakened: { 1: 60, 2: 30, 3: 40, 9: 20, 10: 30, 11: 40 } }
};

export function tacticEffects(id: CharacterId, awakened: boolean, month: number): Effect[] {
  if (month === 4 && id !== 'tokugawa_ieyasu') return [{ type: 'HEAL', amount: id === 'toyotomi_hideyoshi' && awakened ? 40 : 20 }];
  if (month === 8) {
    const heads = id === 'maeda_keiji' ? (awakened ? 100 : 100) : id === 'saika_magoichi' && awakened ? 120 : 50;
    return [{ type: 'COIN', heads, tailsSelfDamage: id === 'saika_magoichi' && awakened ? 0 : 10, attackClass: 'cavalry' }];
  }
  if (id === 'saika_magoichi' && month === 10) return [{ type: 'COIN', heads: awakened ? 120 : 100, tailsSelfDamage: awakened ? -70 : -50, attackClass: 'ranged' }];
  const amount = overrides[id]?.[awakened ? 'awakened' : 'normal']?.[month] ?? baseDamage[month - 1] ?? 0;
  const effects: Effect[] = [];
  if (id === 'tokugawa_ieyasu' && month === 3) effects.push({ type: 'HEAL', amount: 30 });
  if (month === 12) effects.push({ type: 'ADD_FIELD_FROM_DECK', count: 1 });
  if (id === 'toyotomi_hideyoshi' && month === 12) effects.push({ type: 'RANDOM_HAND_TO_FIELD' });
  if (amount > 0) effects.unshift({ type: 'DAMAGE', amount, attackClass: attackClass(month), normalAttack: true });
  return effects;
}

export function describeMonthlyTactic(id: CharacterId, awakened: boolean, month: number): string {
  const effects = tacticEffects(id, awakened, month);
  if (effects.length === 0) return '直接効果なし（札を集めて役・必殺を狙う月）';
  return effects.map((effect) => {
    if (effect.type === 'DAMAGE') return `相手に${effect.amount}ダメージ`;
    if (effect.type === 'HEAL') return `自分のHPを${effect.amount}回復`;
    if (effect.type === 'COIN') {
      const tails = effect.tailsSelfDamage > 0 ? `裏：自分に${effect.tailsSelfDamage}ダメージ` : `裏：相手に${-effect.tailsSelfDamage}ダメージ`;
      return `コイン（表：相手に${effect.heads}ダメージ／${tails}）`;
    }
    if (effect.type === 'ADD_FIELD_FROM_DECK') return `山札から場に${effect.count}枚追加`;
    return '相手の手札をランダムに1枚、場へ出す（1対局に1回）';
  }).join('、');
}

export function finisherDamage(id: CharacterId, score: number): number | 'INSTANT' {
  if (id === 'maeda_keiji' && score !== 5 && score % 2 === 1) return 'INSTANT';
  const increment = ['uesugi_kenshin', 'takeda_shingen', 'oda_nobunaga'].includes(id) ? 20 : 10;
  const base = id === 'sanada_yukimura' ? 100 : 50;
  return base + Math.max(0, score - 5) * increment;
}
