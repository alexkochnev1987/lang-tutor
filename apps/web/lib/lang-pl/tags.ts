/**
 * Польский языковой плагин: расшифровка тегов SGJP.
 *
 * Движок обращается с тегами как с непрозрачными строками (R8) — вся
 * польская специфика живёт здесь. Для немецкого будет свой модуль с той
 * же сигнатурой.
 *
 * Формат тега SGJP: subst:pl:gen:f · fin:sg:pri:imperf · adj:sg:nom:m1:pos
 */

/** Падеж в предложном падеже: «поставьте в родительном падеже». */
const CASE_LOC: Record<string, string> = {
  nom: 'именительном', gen: 'родительном', dat: 'дательном',
  acc: 'винительном', inst: 'творительном', loc: 'предложном', voc: 'звательном',
}

/** Тот же падеж в именительном: «родительный падеж». */
const CASE_NOM: Record<string, string> = {
  nom: 'именительный', gen: 'родительный', dat: 'дательный',
  acc: 'винительный', inst: 'творительный', loc: 'предложный', voc: 'звательный',
}

const PERSONS: Record<string, string> = { pri: '1 лицо', sec: '2 лицо', ter: '3 лицо' }

/**
 * Род и подрод в теге SGJP. Пустая строка — форма одинакова для всех
 * родов, уточнять нечего.
 *
 * Без рода подпись к прилагательному неоднозначна: «именительный падеж,
 * ед. ч.» одинаково описывает `ładna`, `ładne` и `ładny`, и учащийся не
 * может выбрать верный вариант не угадывая.
 */
const GENDERS: Record<string, string> = {
  'm1': 'мужско-личный род',
  'm1.m2': 'м. р., одушевлённое',
  'm1.m2.m3': 'м. р.',
  'm1.m2.m3.n': 'м./ср. р.',
  'm1.m2.m3.f.n': '',
  'm2.m3': 'м. р., неличное',
  'm2.m3.f.n': 'немужско-личный род',
  'm2.m3.n': 'м. р. неличное и ср. р.',
  'm3': 'м. р., неодушевлённое',
  'f': 'ж. р.',
  'n': 'ср. р.',
}

const DEGREES: Record<string, string> = {
  com: 'Сравнительная степень', sup: 'Превосходная степень',
}

/** Сегмент тега, состоящий только из родовых кодов: `f`, `m1.m2.m3`, … */
const GENDER_SEGMENT = /^(m[123]|f|n)(\.(m[123]|f|n))*$/

function genderOf(parts: string[]): string {
  const seg = parts.find((x) => GENDER_SEGMENT.test(x))
  return seg ? GENDERS[seg] ?? '' : ''
}

/** Склеивает непустые уточнения через запятую. */
const join = (...xs: (string | undefined)[]) => xs.filter(Boolean).join(', ')

/** Человекочитаемая инструкция к упражнению. */
export function labelTag(tag: string): string {
  const p = tag.split(':')
  const pos = p[0]
  const plural = p.includes('pl')
  const num = plural ? 'мн. ч.' : 'ед. ч.'
  const c = p.find((x) => x in CASE_LOC)
  const gender = genderOf(p)
  const person = p.find((x) => x in PERSONS)

  // ── Существительные и отглагольные существительные ──────────────────
  if (pos === 'subst' || pos === 'ger') {
    if (!c) return 'Поставьте в нужную форму'
    return `Поставьте в ${CASE_LOC[c]} падеже, ${num}`
  }

  // ── Прилагательные и местоимённые прилагательные (ten, mój, który) ──
  if (pos === 'adj') {
    const degree = p.find((x) => x in DEGREES)
    if (!c) return degree ? `${DEGREES[degree]} — образуйте форму` : 'Поставьте в нужную форму'
    if (degree) return `${DEGREES[degree]}: ${join(`${CASE_NOM[c]} падеж`, gender, num)}`
    return `Поставьте в ${CASE_LOC[c]} падеже: ${join(gender, num)}`
  }

  // ── Личные формы глагола ────────────────────────────────────────────
  if (pos === 'fin') {
    // Личная форма глагола СОВЕРШЕННОГО вида — это простое будущее,
    // а не настоящее. Назвать её настоящим временем значит учить
    // неверному: `napiszę` — «напишу», не «пишу».
    const tense = p.includes('perf') ? 'Простое будущее время' : 'Настоящее время'
    return `${tense}: ${join(PERSONS[person ?? 'ter'], num)}`
  }

  if (pos === 'praet') {
    // Лицо обязательно: без него `czytał`, `czytałem` и `czytałeś`
    // описываются одной и той же подписью.
    return `Прошедшее время: ${join(PERSONS[person ?? 'ter'], gender, num)}`
  }

  if (pos === 'impt') {
    const who = plural ? (person === 'pri' ? 'my' : 'wy') : 'ty'
    return `Повелительное наклонение: ${who}`
  }

  // Личные формы будущего времени есть только у `być`; SGJP зовёт их
  // `bedzie`, потому что остальные глаголы несовершенного вида образуют
  // будущее описательно.
  if (pos === 'bedzie') return `Будущее время: ${join(PERSONS[person ?? 'ter'], num)}`

  if (pos === 'inf') return 'Неопределённая форма'
  if (pos === 'pcon') return 'Деепричастие одновременного действия'

  // ── Закрытые классы: ручные таблицы из closed-class.ts ──────────────
  if (pos === 'ppron12' || pos === 'ppron3') {
    // akc/nakc — ударная и краткая (клитическая) формы: `mnie` vs `mi`.
    // Это разные слова для учащегося, подпись обязана их различать.
    const clitic = p.includes('nakc') ? 'краткая форма'
      : p.includes('akc') ? 'ударная форма' : undefined
    // jego → do niego: после предлога у местоимений 3 лица другая основа
    const prep = p.includes('praep') ? 'после предлога'
      : p.includes('npraep') ? 'без предлога' : undefined
    if (!c) return 'Личное местоимение — образуйте форму'
    return `Личное местоимение: ${join(`${CASE_NOM[c]} падеж`, gender, num, clitic, prep)}`
  }

  if (pos === 'siebie') {
    if (!c) return 'Возвратное местоимение — образуйте форму'
    const clitic = p.includes('nakc') ? 'краткая форма' : undefined
    return `Возвратное местоимение: ${join(`${CASE_NOM[c]} падеж`, clitic)}`
  }

  if (pos === 'num') {
    // congr — согласуемая форма (dwa stoły), rec — требующая родительного
    // падежа (dwóch studentów). Разница и есть предмет правила.
    const kind = p.includes('rec') ? 'форма, требующая родительного падежа'
      : p.includes('congr') ? 'форма, согласуемая с существительным' : undefined
    if (!c) return 'Числительное — образуйте форму'
    return `Числительное: ${join(`${CASE_NOM[c]} падеж`, gender, kind)}`
  }

  return 'Поставьте в нужную форму'
}

/**
 * Какие формы проверять для конкретного грамматического правила.
 * Связь «правило → теги» принципиально языковая, поэтому живёт здесь.
 *
 * Префикс обязан реально встречаться в парадигмах курса
 * (`content/pl-b1-ru/morphology.json` + таблицы из `closed-class.ts`).
 * Разметка, ведущая в пустоту, хуже отсутствия разметки: правило
 * выглядит покрытым, а упражнений по нему нет.
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
  // Род: в именительном падеже форма равна лемме и упражнения из неё не
  // выходит — поэтому запасной тег творительный, где род и проявляется
  // окончанием: -em у м./ср. р. против -ą у ж. р.
  'pl.gram.gender': ['subst:sg:nom', 'subst:sg:inst'],
  'pl.gram.masc-personal': ['subst:pl:nom:m1'],

  // Одушевлённость видна только на винительном падеже мужского рода:
  // у m1/m2 он совпадает с родительным, у m3 — с именительным.
  // Упражнение строится на m1-словах: у m3 ответ равен лемме и
  // генератор такое отбрасывает.
  'pl.gram.animacy': ['subst:sg:acc:m1', 'subst:pl:acc:m1'],

  'pl.gram.k-adj-agreement': ['adj:sg:nom', 'adj:pl:nom'],

  // Степени сравнения: теги :com и :sup есть у 11 прилагательных курса.
  'pl.gram.k-comparative': [
    'adj:sg:nom:m1.m2.m3:com', 'adj:sg:nom:m1.m2.m3:sup',
    'adj:sg:nom:f:com', 'adj:sg:nom:f:sup',
  ],

  'pl.gram.v-present-1': ['fin:sg:pri', 'fin:sg:sec', 'fin:pl:ter'],
  'pl.gram.v-present-2': ['fin:sg:pri', 'fin:pl:pri'],
  'pl.gram.v-present-3': ['fin:sg:pri', 'fin:sg:sec'],
  'pl.gram.v-present-4': ['fin:sg:pri', 'fin:pl:ter'],
  'pl.gram.v-present-irregular': ['fin:sg:pri', 'fin:pl:ter'],

  // Будущее простое — это личная форма глагола совершенного вида.
  // Отдельного «будущего» в парадигме нет и быть не должно: `kupię`
  // лежит под fin:sg:pri:perf.
  'pl.gram.v-future-simple': ['fin:sg:pri:perf', 'fin:sg:sec:perf', 'fin:pl:pri:perf'],

  'pl.gram.v-past-sg': ['praet:sg'],
  'pl.gram.v-past-pl': ['praet:pl'],

  // Подвижные окончания -(e)m, -(e)ś, -śmy, -ście живут в личных формах
  // прошедшего времени. Дрилл на их образование — ровно то, что отрывается
  // от глагола в `gdzieś był`.
  'pl.gram.v-movable-endings': [
    'praet:sg:m1.m2.m3:pri', 'praet:sg:m1.m2.m3:sec',
    'praet:sg:f:pri', 'praet:sg:f:sec',
    'praet:pl:m1:pri', 'praet:pl:m2.m3.f.n:pri',
  ],

  'pl.gram.v-imperative': ['impt:sg:sec'],

  // ── Закрытые классы: парадигмы из closed-class.ts ──────────────────
  // В дампе SGJP, из которого собран morphology.json, местоимений,
  // числительных и `być` нет. Слова для этих правил берутся не из
  // лексики дня, а из RULE_TO_CLOSED_LEMMAS.

  'pl.gram.v-byc': [
    'fin:sg:pri:imperf', 'fin:sg:sec:imperf', 'fin:pl:pri:imperf',
    'fin:pl:ter:imperf', 'fin:sg:ter:imperf', 'fin:pl:sec:imperf',
  ],

  'pl.gram.p-personal': [
    // краткая форма идёт первой: `mi` вместо `mnie` — ровно то место,
    // где русскоязычный ошибается
    'ppron12:sg:dat:m1.m2.m3.f.n:pri:nakc',
    'ppron12:sg:gen', 'ppron12:sg:inst', 'ppron12:pl:dat', 'ppron12:pl:gen',
    'ppron3:sg:dat', 'ppron3:sg:acc', 'ppron3:sg:gen', 'ppron3:sg:inst',
    'ppron3:pl:dat', 'ppron3:pl:gen',
  ],

  'pl.gram.p-formal-pan': [
    'subst:sg:voc', 'subst:sg:inst', 'subst:sg:dat', 'subst:sg:acc',
    'subst:sg:gen', 'subst:pl:nom',
  ],

  'pl.gram.p-demonstrative': [
    'adj:sg:acc:f:pos', 'adj:sg:gen:m1.m2.m3.n:pos', 'adj:sg:dat:m1.m2.m3.n:pos',
    'adj:pl:nom:m1:pos', 'adj:sg:inst:f:pos', 'adj:pl:gen:m1.m2.m3.f.n:pos',
  ],

  'pl.gram.p-possessive': [
    'adj:sg:gen:m1.m2.m3.n:pos', 'adj:sg:acc:f:pos', 'adj:pl:nom:m1:pos',
    'adj:sg:dat:m1.m2.m3.n:pos', 'adj:pl:inst:m1.m2.m3.f.n:pos',
  ],

  'pl.gram.p-interrogative': [
    'subst:sg:gen', 'subst:sg:dat', 'subst:sg:inst',
    'adj:sg:gen:m1.m2.m3.n:pos', 'adj:sg:acc:f:pos', 'adj:pl:nom:m1:pos',
    'adj:sg:loc:m1.m2.m3.n:pos',
  ],

  'pl.gram.p-indefinite-negative': [
    'subst:sg:gen', 'subst:sg:dat', 'subst:sg:inst', 'subst:sg:loc',
  ],

  'pl.gram.p-reflexive-siebie': [
    'siebie:dat', 'siebie:inst', 'siebie:loc', 'siebie:acc:nakc',
  ],

  'pl.gram.n-cardinal-1-4': [
    'adj:sg:nom:f:pos', 'adj:sg:nom:n:pos',
    'num:pl:nom:f:congr', 'num:pl:gen', 'num:pl:dat', 'num:pl:inst',
  ],

  'pl.gram.n-cardinal-5plus': [
    'num:pl:gen', 'num:pl:inst', 'num:pl:dat', 'num:pl:loc',
  ],

  // Мужско-личные формы — единственное, ради чего правило существует
  'pl.gram.n-masc-personal': [
    'num:pl:nom:m1:congr', 'num:pl:nom:m1:rec', 'num:pl:acc:m1:rec',
  ],

  'pl.gram.n-ordinal': [
    'adj:sg:loc:m1.m2.m3.n:pos', 'adj:sg:gen:m1.m2.m3.n:pos',
    'adj:sg:nom:f:pos', 'adj:sg:inst:f:pos', 'adj:pl:nom:m1:pos',
  ],
}

/** Находит в парадигме полный тег, начинающийся с префикса. */
export function resolveTag(paradigm: Record<string, string[]>, prefix: string): string | null {
  // Двувидовые глаголы: у них одна и та же личная форма помечена в SGJP
  // и как perf, и как imperf. Для правила «простое будущее» это ловушка:
  // `wychodzić → wychodzę` формально подойдёт под `fin:sg:pri:perf`, а
  // подпись скажет «будущее время» — и человек выучит неправду.
  // Такую клетку отдавать нельзя: пусть правило пропустит это слово.
  if (prefix.endsWith(':perf')) {
    const base = prefix.slice(0, -':perf'.length)
    if (Object.keys(paradigm).some((t) => t.startsWith(`${base}:imperf`))) return null
  }
  return Object.keys(paradigm).find((t) => t.startsWith(prefix)) ?? null
}
