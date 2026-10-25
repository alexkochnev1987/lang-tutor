/**
 * Закрытые классы польского: местоимения, числительные, глагол `być`.
 *
 * ПОЧЕМУ ЭТО РУЧНЫЕ ТАБЛИЦЫ, А НЕ ВЫГРУЗКА ИЗ SGJP
 *
 * `content/pl-b1-ru/morphology.json` собран скриптом `build-morphology.mjs`
 * из дампа SGJP, и в нём оставлены только те части речи, которые нужны
 * были на момент сборки: subst, adj, fin, praet, impt, inf, ger, pcon.
 * Местоимений (`ppron12`, `ppron3`, `siebie`), числительных (`num`) и
 * неправильного `być` там нет вовсе, а самого дампа на машине сборки
 * больше нет — пересобрать нельзя.
 *
 * Классы закрытые: это конечные списки из десятка-другого слов, которые
 * не меняются. Выписать их руками дешевле, чем ждать пересборки, и
 * надёжнее, чем генерировать по правилам — здесь почти всё супплетивно
 * (`ja → mnie`, `dwa → dwóch`, `być → jestem`).
 *
 * КОНТРАКТ
 *
 * Формат тот же, что у парадигм из morphology.json:
 * `Record<лемма, Record<тег SGJP, формы[]>>`. Таблицы подмешиваются к
 * морфологии в `lib/content/curriculum.ts` — на границе загрузки
 * контента, не в движке (R8: `packages/engine` не знает про польский).
 *
 * КАЧЕСТВО
 *
 * Клетка, в форме которой нет уверенности, не заполняется вовсе:
 * пустая клетка просто не даст упражнения, а неверная — научит ошибке.
 * Все такие пропуски помечены комментарием `// пропуск:`.
 */

type Paradigm = Record<string, string[]>

// ─────────────────────────────────────────────────────────────────────
// Склонение прилагательного типа — им склоняются ten, mój, jaki,
// jeden и порядковые числительные. SGJP помечает их все как `adj:…:pos`
// (ровно так в morphology.json лежит `который` → `który`).
// ─────────────────────────────────────────────────────────────────────

interface AdjForms {
  /** им. п. ед. ч. м. р. (он же вин. п. неодуш.): ten, mój, pierwszy */
  m: string
  /** род. п. ед. ч. м./ср. р. (он же вин. п. одуш.): tego, mojego */
  mGen: string
  /** дат. п. ед. ч. м./ср. р.: temu, mojemu */
  mDat: string
  /** твор. и предл. п. ед. ч. м./ср. р.: tym, moim */
  mInst: string
  /** им. п. ед. ч. ж. р.: ta, moja */
  f: string
  /** род., дат. и предл. п. ед. ч. ж. р.: tej, mojej */
  fGen: string
  /** вин. п. ед. ч. ж. р.: tę, moją — у `ten` отличается от творительного */
  fAcc: string
  /** твор. п. ед. ч. ж. р.: tą, moją */
  fInst: string
  /** им. и вин. п. ед. ч. ср. р.: to, moje */
  n: string
  /** им. п. мн. ч. мужско-личный: ci, moi. null — формы нет или она спорна */
  plM1: string | null
  /** им. и вин. п. мн. ч. немужско-личный: te, moje */
  plRest: string
  /** род. и предл. п. мн. ч. (он же вин. п. мужско-личный): tych, moich */
  plGen: string
  /** дат. п. мн. ч.: tym, moim */
  plDat: string
  /** твор. п. мн. ч.: tymi, moimi */
  plInst: string
}

function adjTable(x: AdjForms): Paradigm {
  const p: Paradigm = {
    'adj:sg:nom:m1.m2.m3:pos': [x.m],
    'adj:sg:acc:m3:pos': [x.m],
    'adj:sg:gen:m1.m2.m3.n:pos': [x.mGen],
    'adj:sg:acc:m1.m2:pos': [x.mGen],
    'adj:sg:dat:m1.m2.m3.n:pos': [x.mDat],
    'adj:sg:inst:m1.m2.m3.n:pos': [x.mInst],
    'adj:sg:loc:m1.m2.m3.n:pos': [x.mInst],
    'adj:sg:nom:f:pos': [x.f],
    'adj:sg:gen:f:pos': [x.fGen],
    'adj:sg:dat:f:pos': [x.fGen],
    'adj:sg:loc:f:pos': [x.fGen],
    'adj:sg:acc:f:pos': [x.fAcc],
    'adj:sg:inst:f:pos': [x.fInst],
    'adj:sg:nom:n:pos': [x.n],
    'adj:sg:acc:n:pos': [x.n],
    'adj:pl:nom:m2.m3.f.n:pos': [x.plRest],
    'adj:pl:acc:m2.m3.f.n:pos': [x.plRest],
    'adj:pl:gen:m1.m2.m3.f.n:pos': [x.plGen],
    'adj:pl:acc:m1:pos': [x.plGen],
    'adj:pl:loc:m1.m2.m3.f.n:pos': [x.plGen],
    'adj:pl:dat:m1.m2.m3.f.n:pos': [x.plDat],
    'adj:pl:inst:m1.m2.m3.f.n:pos': [x.plInst],
  }
  if (x.plM1) p['adj:pl:nom:m1:pos'] = [x.plM1]
  return p
}

// ─────────────────────────────────────────────────────────────────────
// 1. Личные местоимения
//
// `akc` / `nakc` — ударная и краткая (клитическая) формы: `mnie` против
// `mi`, `jego` против `go`. Для русскоязычного это главная трудность
// темы, поэтому формы разведены по разным тегам: иначе подпись к
// заданию не отличала бы одну от другой.
//
// `praep` / `npraep` — форма после предлога и без него: `jego` → `do
// niego`. Предложный падеж без предлога не встречается вовсе, поэтому
// у него только praep-форма.
// ─────────────────────────────────────────────────────────────────────

const PERSONAL: Record<string, Paradigm> = {
  ja: {
    'ppron12:sg:nom:m1.m2.m3.f.n:pri': ['ja'],
    'ppron12:sg:gen:m1.m2.m3.f.n:pri:akc': ['mnie'],
    'ppron12:sg:dat:m1.m2.m3.f.n:pri:akc': ['mnie'],
    'ppron12:sg:dat:m1.m2.m3.f.n:pri:nakc': ['mi'],
    'ppron12:sg:acc:m1.m2.m3.f.n:pri:akc': ['mnie'],
    'ppron12:sg:inst:m1.m2.m3.f.n:pri': ['mną'],
    'ppron12:sg:loc:m1.m2.m3.f.n:pri': ['mnie'],
    // пропуск: краткое вин. `mię` — устаревшее, в B1 не нужно
  },
  ty: {
    'ppron12:sg:nom:m1.m2.m3.f.n:sec': ['ty'],
    'ppron12:sg:gen:m1.m2.m3.f.n:sec:akc': ['ciebie'],
    'ppron12:sg:gen:m1.m2.m3.f.n:sec:nakc': ['cię'],
    'ppron12:sg:dat:m1.m2.m3.f.n:sec:akc': ['tobie'],
    'ppron12:sg:dat:m1.m2.m3.f.n:sec:nakc': ['ci'],
    'ppron12:sg:acc:m1.m2.m3.f.n:sec:akc': ['ciebie'],
    'ppron12:sg:acc:m1.m2.m3.f.n:sec:nakc': ['cię'],
    'ppron12:sg:inst:m1.m2.m3.f.n:sec': ['tobą'],
    'ppron12:sg:loc:m1.m2.m3.f.n:sec': ['tobie'],
  },
  my: {
    'ppron12:pl:nom:m1.m2.m3.f.n:pri': ['my'],
    'ppron12:pl:gen:m1.m2.m3.f.n:pri': ['nas'],
    'ppron12:pl:dat:m1.m2.m3.f.n:pri': ['nam'],
    'ppron12:pl:acc:m1.m2.m3.f.n:pri': ['nas'],
    'ppron12:pl:inst:m1.m2.m3.f.n:pri': ['nami'],
    'ppron12:pl:loc:m1.m2.m3.f.n:pri': ['nas'],
  },
  wy: {
    'ppron12:pl:nom:m1.m2.m3.f.n:sec': ['wy'],
    'ppron12:pl:gen:m1.m2.m3.f.n:sec': ['was'],
    'ppron12:pl:dat:m1.m2.m3.f.n:sec': ['wam'],
    'ppron12:pl:acc:m1.m2.m3.f.n:sec': ['was'],
    'ppron12:pl:inst:m1.m2.m3.f.n:sec': ['wami'],
    'ppron12:pl:loc:m1.m2.m3.f.n:sec': ['was'],
  },
  on: {
    'ppron3:sg:nom:m1.m2.m3:ter': ['on'],
    'ppron3:sg:gen:m1.m2.m3:ter:akc:npraep': ['jego'],
    'ppron3:sg:gen:m1.m2.m3:ter:nakc:npraep': ['go'],
    'ppron3:sg:gen:m1.m2.m3:ter:akc:praep': ['niego'],
    'ppron3:sg:dat:m1.m2.m3:ter:akc:npraep': ['jemu'],
    'ppron3:sg:dat:m1.m2.m3:ter:nakc:npraep': ['mu'],
    'ppron3:sg:dat:m1.m2.m3:ter:akc:praep': ['niemu'],
    'ppron3:sg:acc:m1.m2.m3:ter:akc:npraep': ['jego'],
    'ppron3:sg:acc:m1.m2.m3:ter:nakc:npraep': ['go'],
    'ppron3:sg:acc:m1.m2.m3:ter:akc:praep': ['niego'],
    'ppron3:sg:inst:m1.m2.m3:ter:praep': ['nim'],
    'ppron3:sg:loc:m1.m2.m3:ter:praep': ['nim'],
  },
  ona: {
    'ppron3:sg:nom:f:ter': ['ona'],
    'ppron3:sg:gen:f:ter:akc:npraep': ['jej'],
    'ppron3:sg:gen:f:ter:akc:praep': ['niej'],
    'ppron3:sg:dat:f:ter:akc:npraep': ['jej'],
    'ppron3:sg:dat:f:ter:akc:praep': ['niej'],
    'ppron3:sg:acc:f:ter:akc:npraep': ['ją'],
    'ppron3:sg:acc:f:ter:akc:praep': ['nią'],
    'ppron3:sg:inst:f:ter:praep': ['nią'],
    'ppron3:sg:loc:f:ter:praep': ['niej'],
  },
  ono: {
    'ppron3:sg:nom:n:ter': ['ono'],
    'ppron3:sg:gen:n:ter:akc:npraep': ['jego'],
    'ppron3:sg:gen:n:ter:nakc:npraep': ['go'],
    'ppron3:sg:gen:n:ter:akc:praep': ['niego'],
    'ppron3:sg:dat:n:ter:akc:npraep': ['jemu'],
    'ppron3:sg:dat:n:ter:nakc:npraep': ['mu'],
    'ppron3:sg:dat:n:ter:akc:praep': ['niemu'],
    'ppron3:sg:acc:n:ter:akc:npraep': ['je'],
    'ppron3:sg:acc:n:ter:akc:praep': ['nie'],
    'ppron3:sg:inst:n:ter:praep': ['nim'],
    'ppron3:sg:loc:n:ter:praep': ['nim'],
  },
  oni: {
    'ppron3:pl:nom:m1:ter': ['oni'],
    'ppron3:pl:gen:m1:ter:akc:npraep': ['ich'],
    'ppron3:pl:gen:m1:ter:akc:praep': ['nich'],
    'ppron3:pl:dat:m1:ter:akc:npraep': ['im'],
    'ppron3:pl:dat:m1:ter:akc:praep': ['nim'],
    'ppron3:pl:acc:m1:ter:akc:npraep': ['ich'],
    'ppron3:pl:acc:m1:ter:akc:praep': ['nich'],
    'ppron3:pl:inst:m1:ter:praep': ['nimi'],
    'ppron3:pl:loc:m1:ter:praep': ['nich'],
  },
  one: {
    'ppron3:pl:nom:m2.m3.f.n:ter': ['one'],
    'ppron3:pl:gen:m2.m3.f.n:ter:akc:npraep': ['ich'],
    'ppron3:pl:gen:m2.m3.f.n:ter:akc:praep': ['nich'],
    'ppron3:pl:dat:m2.m3.f.n:ter:akc:npraep': ['im'],
    'ppron3:pl:dat:m2.m3.f.n:ter:akc:praep': ['nim'],
    'ppron3:pl:acc:m2.m3.f.n:ter:akc:npraep': ['je'],
    'ppron3:pl:acc:m2.m3.f.n:ter:akc:praep': ['nie'],
    'ppron3:pl:inst:m2.m3.f.n:ter:praep': ['nimi'],
    'ppron3:pl:loc:m2.m3.f.n:ter:praep': ['nich'],
  },
}

// ─────────────────────────────────────────────────────────────────────
// 2. Возвратное siebie
//
// Именительного падежа у него нет. `się` — краткая форма винительного;
// современный SGJP разбирает `się` как частицу, но для учащегося это
// именно вторая форма того же местоимения, и противопоставление
// `siebie / się` — содержание правила.
// ─────────────────────────────────────────────────────────────────────

const REFLEXIVE: Record<string, Paradigm> = {
  siebie: {
    'siebie:gen': ['siebie'],
    'siebie:dat': ['sobie'],
    'siebie:acc': ['siebie'],
    'siebie:acc:nakc': ['się'],
    'siebie:inst': ['sobą'],
    'siebie:loc': ['sobie'],
  },
}

// ─────────────────────────────────────────────────────────────────────
// 3. Указательные и притяжательные
//
// Стяжённые книжные варианты (`mego`, `memu`, `mym`, `mej`) намеренно
// не внесены: на B1 они не нужны, а в закрытом выборе они стали бы
// дистракторами, формально верными.
// ─────────────────────────────────────────────────────────────────────

const DEMONSTRATIVE: Record<string, Paradigm> = {
  // `ten` — единственное слово этого типа, где вин. п. ж. р. (`tę`)
  // отличается от творительного (`tą`). Разговорное `tą` в винительном
  // не вносим: экзамен проверяет норму.
  ten: adjTable({
    m: 'ten', mGen: 'tego', mDat: 'temu', mInst: 'tym',
    f: 'ta', fGen: 'tej', fAcc: 'tę', fInst: 'tą',
    n: 'to', plM1: 'ci', plRest: 'te',
    plGen: 'tych', plDat: 'tym', plInst: 'tymi',
  }),
  tamten: adjTable({
    m: 'tamten', mGen: 'tamtego', mDat: 'tamtemu', mInst: 'tamtym',
    f: 'tamta', fGen: 'tamtej', fAcc: 'tamtą', fInst: 'tamtą',
    n: 'tamto', plM1: 'tamci', plRest: 'tamte',
    plGen: 'tamtych', plDat: 'tamtym', plInst: 'tamtymi',
  }),
}

const POSSESSIVE: Record<string, Paradigm> = {
  mój: adjTable({
    m: 'mój', mGen: 'mojego', mDat: 'mojemu', mInst: 'moim',
    f: 'moja', fGen: 'mojej', fAcc: 'moją', fInst: 'moją',
    n: 'moje', plM1: 'moi', plRest: 'moje',
    plGen: 'moich', plDat: 'moim', plInst: 'moimi',
  }),
  twój: adjTable({
    m: 'twój', mGen: 'twojego', mDat: 'twojemu', mInst: 'twoim',
    f: 'twoja', fGen: 'twojej', fAcc: 'twoją', fInst: 'twoją',
    n: 'twoje', plM1: 'twoi', plRest: 'twoje',
    plGen: 'twoich', plDat: 'twoim', plInst: 'twoimi',
  }),
  nasz: adjTable({
    m: 'nasz', mGen: 'naszego', mDat: 'naszemu', mInst: 'naszym',
    f: 'nasza', fGen: 'naszej', fAcc: 'naszą', fInst: 'naszą',
    n: 'nasze', plM1: 'nasi', plRest: 'nasze',
    plGen: 'naszych', plDat: 'naszym', plInst: 'naszymi',
  }),
  wasz: adjTable({
    m: 'wasz', mGen: 'waszego', mDat: 'waszemu', mInst: 'waszym',
    f: 'wasza', fGen: 'waszej', fAcc: 'waszą', fInst: 'waszą',
    n: 'wasze', plM1: 'wasi', plRest: 'wasze',
    plGen: 'waszych', plDat: 'waszym', plInst: 'waszymi',
  }),
  swój: adjTable({
    m: 'swój', mGen: 'swojego', mDat: 'swojemu', mInst: 'swoim',
    f: 'swoja', fGen: 'swojej', fAcc: 'swoją', fInst: 'swoją',
    n: 'swoje', plM1: 'swoi', plRest: 'swoje',
    plGen: 'swoich', plDat: 'swoim', plInst: 'swoimi',
  }),
}

// ─────────────────────────────────────────────────────────────────────
// 4. Вопросительные, неопределённые и отрицательные
//
// `kto` и `co` склоняются по именному типу, поэтому помечены как
// `subst`; род у `kto` мужско-личный (`kto przyszedł`), у `co` средний.
// `który` сюда не внесён: он уже есть в morphology.json из SGJP.
// ─────────────────────────────────────────────────────────────────────

const QUESTION_NOUNS: Record<string, Paradigm> = {
  kto: {
    'subst:sg:nom:m1': ['kto'],
    'subst:sg:gen:m1': ['kogo'],
    'subst:sg:dat:m1': ['komu'],
    'subst:sg:acc:m1': ['kogo'],
    'subst:sg:inst:m1': ['kim'],
    'subst:sg:loc:m1': ['kim'],
  },
  co: {
    'subst:sg:nom:n': ['co'],
    'subst:sg:gen:n': ['czego'],
    'subst:sg:dat:n': ['czemu'],
    'subst:sg:acc:n': ['co'],
    'subst:sg:inst:n': ['czym'],
    'subst:sg:loc:n': ['czym'],
  },
  ktoś: {
    'subst:sg:nom:m1': ['ktoś'],
    'subst:sg:gen:m1': ['kogoś'],
    'subst:sg:dat:m1': ['komuś'],
    'subst:sg:acc:m1': ['kogoś'],
    'subst:sg:inst:m1': ['kimś'],
    'subst:sg:loc:m1': ['kimś'],
  },
  coś: {
    'subst:sg:nom:n': ['coś'],
    'subst:sg:gen:n': ['czegoś'],
    'subst:sg:dat:n': ['czemuś'],
    'subst:sg:acc:n': ['coś'],
    'subst:sg:inst:n': ['czymś'],
    'subst:sg:loc:n': ['czymś'],
  },
  nikt: {
    'subst:sg:nom:m1': ['nikt'],
    'subst:sg:gen:m1': ['nikogo'],
    'subst:sg:dat:m1': ['nikomu'],
    'subst:sg:acc:m1': ['nikogo'],
    'subst:sg:inst:m1': ['nikim'],
    'subst:sg:loc:m1': ['nikim'],
  },
  nic: {
    'subst:sg:nom:n': ['nic'],
    'subst:sg:dat:n': ['niczemu'],
    'subst:sg:acc:n': ['nic'],
    'subst:sg:inst:n': ['niczym'],
    'subst:sg:loc:n': ['niczym'],
    // пропуск: род. п. — норма допускает и `niczego`, и `nic`
    // (`nie mam nic` / `niczego nie widzę`). В закрытом выборе один из
    // двух верных вариантов оказался бы «ошибкой», поэтому клетки нет.
  },
}

const QUESTION_ADJ: Record<string, Paradigm> = {
  jaki: adjTable({
    m: 'jaki', mGen: 'jakiego', mDat: 'jakiemu', mInst: 'jakim',
    f: 'jaka', fGen: 'jakiej', fAcc: 'jaką', fInst: 'jaką',
    n: 'jakie', plM1: 'jacy', plRest: 'jakie',
    plGen: 'jakich', plDat: 'jakim', plInst: 'jakimi',
  }),
  czyj: adjTable({
    m: 'czyj', mGen: 'czyjego', mDat: 'czyjemu', mInst: 'czyim',
    f: 'czyja', fGen: 'czyjej', fAcc: 'czyją', fInst: 'czyją',
    n: 'czyje', plM1: 'czyi', plRest: 'czyje',
    plGen: 'czyich', plDat: 'czyim', plInst: 'czyimi',
  }),
}

// ─────────────────────────────────────────────────────────────────────
// 5. Вежливые Pan / Pani
//
// `państwo` намеренно не внесено: форма у него единственного числа
// (`Państwa`, `Państwu`), а согласование — множественного, и подпись
// «ед. ч.» к такому заданию вводила бы в заблуждение. Вежливое
// обращение множественного числа остаётся за шаблонами предложений.
// ─────────────────────────────────────────────────────────────────────

const POLITE: Record<string, Paradigm> = {
  pan: {
    'subst:sg:nom:m1': ['pan'],
    'subst:sg:gen:m1': ['pana'],
    'subst:sg:dat:m1': ['panu'],
    'subst:sg:acc:m1': ['pana'],
    'subst:sg:inst:m1': ['panem'],
    'subst:sg:loc:m1': ['panu'],
    'subst:sg:voc:m1': ['panie'],
    'subst:pl:nom:m1': ['panowie'],
    'subst:pl:gen:m1': ['panów'],
    'subst:pl:dat:m1': ['panom'],
    'subst:pl:acc:m1': ['panów'],
    'subst:pl:inst:m1': ['panami'],
    'subst:pl:loc:m1': ['panach'],
    'subst:pl:voc:m1': ['panowie'],
  },
  pani: {
    'subst:sg:nom:f': ['pani'],
    'subst:sg:gen:f': ['pani'],
    'subst:sg:dat:f': ['pani'],
    'subst:sg:acc:f': ['panią'],
    'subst:sg:inst:f': ['panią'],
    'subst:sg:loc:f': ['pani'],
    'subst:sg:voc:f': ['pani'],
    'subst:pl:nom:f': ['panie'],
    'subst:pl:gen:f': ['pań'],
    'subst:pl:dat:f': ['paniom'],
    'subst:pl:acc:f': ['panie'],
    'subst:pl:inst:f': ['paniami'],
    'subst:pl:loc:f': ['paniach'],
    'subst:pl:voc:f': ['panie'],
  },
}

// ─────────────────────────────────────────────────────────────────────
// 6. Количественные числительные
//
// `congr` — согласуемая форма (`dwaj studenci`), `rec` — требующая
// родительного падежа (`dwóch studentów`). Обе верны, различаются
// конструкцией, поэтому помечены разными тегами: иначе одна из двух
// правильных форм попадала бы в дистракторы.
//
// В косвенных падежах различия congr/rec нет, и пометка не ставится.
// ─────────────────────────────────────────────────────────────────────

/** 5–10: одна косвенная форма на все падежи плюс особый творительный. */
function numeral5plus(base: string, oblique: string, inst: string): Paradigm {
  return {
    'num:pl:nom:m2.m3.f.n:congr': [base],
    'num:pl:acc:m2.m3.f.n:congr': [base],
    'num:pl:nom:m1:rec': [oblique],
    'num:pl:acc:m1:rec': [oblique],
    'num:pl:gen:m1.m2.m3.f.n': [oblique],
    'num:pl:dat:m1.m2.m3.f.n': [oblique],
    'num:pl:loc:m1.m2.m3.f.n': [oblique],
    'num:pl:inst:m1.m2.m3.f.n': [inst],
  }
}

const CARDINAL: Record<string, Paradigm> = {
  // `jeden` склоняется как прилагательное, поэтому и помечен как adj
  jeden: adjTable({
    m: 'jeden', mGen: 'jednego', mDat: 'jednemu', mInst: 'jednym',
    f: 'jedna', fGen: 'jednej', fAcc: 'jedną', fInst: 'jedną',
    n: 'jedno', plM1: 'jedni', plRest: 'jedne',
    plGen: 'jednych', plDat: 'jednym', plInst: 'jednymi',
  }),
  dwa: {
    'num:pl:nom:m2.m3.n:congr': ['dwa'],
    'num:pl:acc:m2.m3.n:congr': ['dwa'],
    'num:pl:nom:f:congr': ['dwie'],
    'num:pl:acc:f:congr': ['dwie'],
    'num:pl:nom:m1:congr': ['dwaj'],
    'num:pl:nom:m1:rec': ['dwóch'],
    'num:pl:acc:m1:rec': ['dwóch'],
    'num:pl:gen:m1.m2.m3.f.n': ['dwóch'],
    'num:pl:dat:m1.m2.m3.f.n': ['dwóm'],
    'num:pl:loc:m1.m2.m3.f.n': ['dwóch'],
    'num:pl:inst:m1.m2.m3.n': ['dwoma'],
    'num:pl:inst:f': ['dwiema'],
  },
  trzy: {
    'num:pl:nom:m2.m3.f.n:congr': ['trzy'],
    'num:pl:acc:m2.m3.f.n:congr': ['trzy'],
    'num:pl:nom:m1:congr': ['trzej'],
    'num:pl:nom:m1:rec': ['trzech'],
    'num:pl:acc:m1:rec': ['trzech'],
    'num:pl:gen:m1.m2.m3.f.n': ['trzech'],
    'num:pl:dat:m1.m2.m3.f.n': ['trzem'],
    'num:pl:loc:m1.m2.m3.f.n': ['trzech'],
    'num:pl:inst:m1.m2.m3.f.n': ['trzema'],
  },
  cztery: {
    'num:pl:nom:m2.m3.f.n:congr': ['cztery'],
    'num:pl:acc:m2.m3.f.n:congr': ['cztery'],
    'num:pl:nom:m1:congr': ['czterej'],
    'num:pl:nom:m1:rec': ['czterech'],
    'num:pl:acc:m1:rec': ['czterech'],
    'num:pl:gen:m1.m2.m3.f.n': ['czterech'],
    'num:pl:dat:m1.m2.m3.f.n': ['czterem'],
    'num:pl:loc:m1.m2.m3.f.n': ['czterech'],
    'num:pl:inst:m1.m2.m3.f.n': ['czterema'],
  },
  'pięć': numeral5plus('pięć', 'pięciu', 'pięcioma'),
  'sześć': numeral5plus('sześć', 'sześciu', 'sześcioma'),
  siedem: numeral5plus('siedem', 'siedmiu', 'siedmioma'),
  osiem: numeral5plus('osiem', 'ośmiu', 'ośmioma'),
  'dziewięć': numeral5plus('dziewięć', 'dziewięciu', 'dziewięcioma'),
  'dziesięć': numeral5plus('dziesięć', 'dziesięciu', 'dziesięcioma'),
}

// ─────────────────────────────────────────────────────────────────────
// 7. Порядковые 1–10
//
// Склоняются как прилагательные. Мужско-личная форма мн. ч. внесена
// только там, где она употребительна и бесспорна (`pierwsi`, `drudzy`,
// `trzeci`, `czwarci`); у «пятых» и дальше она практически не
// встречается, и угадывать её незачем.
// ─────────────────────────────────────────────────────────────────────

/** Твёрдая основа: окончания -y / -a / -e / -ego / -ej / -emu / -ym. */
function ordinalHard(stem: string, plM1: string | null): Paradigm {
  return adjTable({
    m: `${stem}y`, mGen: `${stem}ego`, mDat: `${stem}emu`, mInst: `${stem}ym`,
    f: `${stem}a`, fGen: `${stem}ej`, fAcc: `${stem}ą`, fInst: `${stem}ą`,
    n: `${stem}e`, plM1, plRest: `${stem}e`,
    plGen: `${stem}ych`, plDat: `${stem}ym`, plInst: `${stem}ymi`,
  })
}

const ORDINAL: Record<string, Paradigm> = {
  pierwszy: ordinalHard('pierwsz', 'pierwsi'),
  // `drugi` — заднеязычная основа: -i и -ie вместо -y и -e
  drugi: adjTable({
    m: 'drugi', mGen: 'drugiego', mDat: 'drugiemu', mInst: 'drugim',
    f: 'druga', fGen: 'drugiej', fAcc: 'drugą', fInst: 'drugą',
    n: 'drugie', plM1: 'drudzy', plRest: 'drugie',
    plGen: 'drugich', plDat: 'drugim', plInst: 'drugimi',
  }),
  // `trzeci` — мягкая основа
  trzeci: adjTable({
    m: 'trzeci', mGen: 'trzeciego', mDat: 'trzeciemu', mInst: 'trzecim',
    f: 'trzecia', fGen: 'trzeciej', fAcc: 'trzecią', fInst: 'trzecią',
    n: 'trzecie', plM1: 'trzeci', plRest: 'trzecie',
    plGen: 'trzecich', plDat: 'trzecim', plInst: 'trzecimi',
  }),
  czwarty: ordinalHard('czwart', 'czwarci'),
  'piąty': ordinalHard('piąt', null),
  'szósty': ordinalHard('szóst', null),
  'siódmy': ordinalHard('siódm', null),
  'ósmy': ordinalHard('ósm', null),
  'dziewiąty': ordinalHard('dziewiąt', null),
  'dziesiąty': ordinalHard('dziesiąt', null),
}

// ─────────────────────────────────────────────────────────────────────
// 8. Глагол `być`
//
// Единственный по-настоящему неправильный глагол польского, и в дампе
// его нет. Формы будущего помечены тегом `bedzie:…` — так их называет
// сам SGJP, отдельной личной формы будущего у остальных глаголов
// несовершенного вида не существует.
// ─────────────────────────────────────────────────────────────────────

const IRREGULAR_VERB: Record<string, Paradigm> = {
  'być': {
    'inf:imperf': ['być'],
    'fin:sg:pri:imperf': ['jestem'],
    'fin:sg:sec:imperf': ['jesteś'],
    'fin:sg:ter:imperf': ['jest'],
    'fin:pl:pri:imperf': ['jesteśmy'],
    'fin:pl:sec:imperf': ['jesteście'],
    'fin:pl:ter:imperf': ['są'],
    'bedzie:sg:pri:imperf': ['będę'],
    'bedzie:sg:sec:imperf': ['będziesz'],
    'bedzie:sg:ter:imperf': ['będzie'],
    'bedzie:pl:pri:imperf': ['będziemy'],
    'bedzie:pl:sec:imperf': ['będziecie'],
    'bedzie:pl:ter:imperf': ['będą'],
    'praet:sg:m1.m2.m3:pri:imperf': ['byłem'],
    'praet:sg:f:pri:imperf': ['byłam'],
    'praet:sg:m1.m2.m3:sec:imperf': ['byłeś'],
    'praet:sg:f:sec:imperf': ['byłaś'],
    'praet:sg:m1.m2.m3:ter:imperf': ['był'],
    'praet:sg:f:ter:imperf': ['była'],
    'praet:sg:n:ter:imperf': ['było'],
    'praet:pl:m1:pri:imperf': ['byliśmy'],
    'praet:pl:m2.m3.f.n:pri:imperf': ['byłyśmy'],
    'praet:pl:m1:sec:imperf': ['byliście'],
    'praet:pl:m2.m3.f.n:sec:imperf': ['byłyście'],
    'praet:pl:m1:ter:imperf': ['byli'],
    'praet:pl:m2.m3.f.n:ter:imperf': ['były'],
    'impt:sg:sec:imperf': ['bądź'],
    'impt:pl:pri:imperf': ['bądźmy'],
    'impt:pl:sec:imperf': ['bądźcie'],
  },
}

/** Все ручные парадигмы закрытых классов. Подмешиваются к morphology.json. */
export const CLOSED_CLASS_PARADIGMS: Record<string, Paradigm> = {
  ...PERSONAL,
  ...REFLEXIVE,
  ...DEMONSTRATIVE,
  ...POSSESSIVE,
  ...QUESTION_NOUNS,
  ...QUESTION_ADJ,
  ...POLITE,
  ...CARDINAL,
  ...ORDINAL,
  ...IRREGULAR_VERB,
}

/**
 * Какие именно слова отрабатываются правилом.
 *
 * Для закрытого класса лексика дня не годится: правило «личные
 * местоимения» — это про `ja` и `on`, а не про слова урока. Если список
 * задан, упражнения строятся только по нему.
 *
 * `który` берётся из morphology.json (SGJP), остальные — из таблиц выше.
 */
const RULE_TO_CLOSED_LEMMAS: Record<string, string[]> = {
  'pl.gram.v-byc': ['być'],
  'pl.gram.p-personal': ['ja', 'ty', 'on', 'ona', 'ono', 'my', 'wy', 'oni', 'one'],
  'pl.gram.p-formal-pan': ['pan', 'pani'],
  'pl.gram.p-demonstrative': ['ten', 'tamten'],
  'pl.gram.p-possessive': ['mój', 'twój', 'nasz', 'wasz', 'swój'],
  'pl.gram.p-interrogative': ['kto', 'co', 'jaki', 'czyj', 'który'],
  'pl.gram.p-indefinite-negative': ['ktoś', 'coś', 'nikt', 'nic'],
  'pl.gram.p-reflexive-siebie': ['siebie'],
  'pl.gram.n-cardinal-1-4': ['jeden', 'dwa', 'trzy', 'cztery'],
  'pl.gram.n-cardinal-5plus': ['pięć', 'sześć', 'siedem', 'osiem', 'dziewięć', 'dziesięć'],
  'pl.gram.n-masc-personal': ['dwa', 'trzy', 'cztery', 'pięć', 'sześć'],
  'pl.gram.n-ordinal': [
    'pierwszy', 'drugi', 'trzeci', 'czwarty', 'piąty',
    'szósty', 'siódmy', 'ósmy', 'dziewiąty', 'dziesiąty',
  ],
}

/** Слово закрытого класса в том виде, в каком его ждёт генератор. */
export interface ClosedClassWord {
  id: string
  lemma: string
}

/** Слова закрытого класса для правила. Пустой массив — правило обычное. */
export function closedClassWordsForRule(ruleId: string): ClosedClassWord[] {
  return (RULE_TO_CLOSED_LEMMAS[ruleId] ?? [])
    .map((lemma) => ({ id: `pl.closed.${lemma}`, lemma }))
}
