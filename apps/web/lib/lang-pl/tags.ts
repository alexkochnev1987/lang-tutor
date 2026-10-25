/**
 * Польский языковой плагин: расшифровка тегов SGJP.
 *
 * Движок обращается с тегами как с непрозрачными строками (R8) — вся
 * польская специфика живёт здесь. Для немецкого будет свой модуль с той
 * же сигнатурой.
 *
 * Формат тега SGJP: subst:pl:gen:f · fin:sg:pri:imperf · adj:sg:nom:m1:pos
 */

const CASES: Record<string, string> = {
  nom: 'именительном', gen: 'родительном', dat: 'дательном',
  acc: 'винительном', inst: 'творительном', loc: 'предложном', voc: 'звательном',
}

const PERSONS: Record<string, string> = { pri: '1 лицо', sec: '2 лицо', ter: '3 лицо' }

/** Человекочитаемая инструкция к упражнению. */
export function labelTag(tag: string): string {
  const p = tag.split(':')
  const pos = p[0]
  const plural = p.includes('pl')
  const num = plural ? 'мн. ч.' : 'ед. ч.'

  if (pos === 'subst' || pos === 'adj') {
    const c = p.find((x) => x in CASES)
    if (!c) return 'Поставьте в нужную форму'
    return `Поставьте в ${CASES[c]} падеже, ${num}`
  }
  if (pos === 'fin') {
    const person = p.find((x) => x in PERSONS)
    return `Настоящее время, ${PERSONS[person ?? 'ter']}, ${num}`
  }
  if (pos === 'praet') {
    const g = /m[123]/.test(p.join(':')) ? 'м. р.' : p.includes('f') ? 'ж. р.' : 'ср. р.'
    return `Прошедшее время, ${num}${plural ? '' : `, ${g}`}`
  }
  if (pos === 'impt') return 'Повелительное наклонение'
  if (pos === 'inf') return 'Неопределённая форма'
  return 'Поставьте в нужную форму'
}

/**
 * Какие формы проверять для конкретного грамматического правила.
 * Связь «правило → теги» принципиально языковая, поэтому живёт здесь.
 */
export const RULE_TO_TAGS: Record<string, string[]> = {
  'pl.gram.c-nom': ['subst:sg:nom', 'subst:pl:nom'],
  'pl.gram.c-gen': ['subst:sg:gen'],
  'pl.gram.c-gen-pl': ['subst:pl:gen'],
  'pl.gram.c-gen-negation': ['subst:sg:gen', 'subst:pl:gen'],
  'pl.gram.c-gen-verbs': ['subst:sg:gen', 'subst:pl:gen'],
  'pl.gram.c-gen-quantity': ['subst:pl:gen'],
  'pl.gram.c-gen-prepositions': ['subst:sg:gen'],
  'pl.gram.c-acc': ['subst:sg:acc', 'subst:pl:acc'],
  'pl.gram.c-acc-prepositions': ['subst:sg:acc'],
  'pl.gram.c-instr': ['subst:sg:inst', 'subst:pl:inst'],
  'pl.gram.c-instr-verbs': ['subst:sg:inst'],
  'pl.gram.c-loc': ['subst:sg:loc', 'subst:pl:loc'],
  'pl.gram.c-loc-prepositions': ['subst:sg:loc'],
  'pl.gram.c-dat': ['subst:sg:dat', 'subst:pl:dat'],
  'pl.gram.c-dat-verbs': ['subst:sg:dat'],
  'pl.gram.c-voc': ['subst:sg:voc'],
  'pl.gram.number': ['subst:pl:nom'],
  'pl.gram.gender': ['subst:sg:nom'],
  'pl.gram.masc-personal': ['subst:pl:nom:m1'],
  'pl.gram.k-adj-agreement': ['adj:sg:nom', 'adj:pl:nom'],
  'pl.gram.v-present-1': ['fin:sg:pri', 'fin:sg:sec', 'fin:pl:ter'],
  'pl.gram.v-present-2': ['fin:sg:pri', 'fin:pl:pri'],
  'pl.gram.v-present-3': ['fin:sg:pri', 'fin:sg:sec'],
  'pl.gram.v-present-4': ['fin:sg:pri', 'fin:pl:ter'],
  'pl.gram.v-present-irregular': ['fin:sg:pri', 'fin:pl:ter'],
  'pl.gram.v-past-sg': ['praet:sg'],
  'pl.gram.v-past-pl': ['praet:pl'],
  'pl.gram.v-imperative': ['impt:sg:sec'],
}

/** Находит в парадигме полный тег, начинающийся с префикса. */
export function resolveTag(paradigm: Record<string, string[]>, prefix: string): string | null {
  return Object.keys(paradigm).find((t) => t.startsWith(prefix)) ?? null
}
