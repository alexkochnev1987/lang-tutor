import { describe, expect, it } from 'vitest'
import {
  check, chooseForm, falseFriendContrast, gapFill, inflect, shuffle,
  spelling, translateProduction, translateRecognition,
  type LexemeLike, type Paradigm,
} from './index'

const CTX = { seed: 42 }

const sklep: LexemeLike = {
  id: 'pl.sklep', lemma: 'sklep', translation: 'магазин',
  transparency: 'false-friend',
  interference: { confusedWith: 'склеп', actuallyIs: 'grobowiec' },
}
const reka: LexemeLike = {
  id: 'pl.reka', lemma: 'ręka', translation: 'рука', transparency: 'transparent',
}

/** Настоящая парадигма из SGJP. */
const REKA: Paradigm = {
  'subst:sg:nom:f': ['ręka'],
  'subst:sg:gen:f': ['ręki'],
  'subst:sg:acc:f': ['rękę'],
  'subst:sg:inst:f': ['ręką'],
  'subst:sg:loc:f': ['ręce'],
  'subst:pl:nom:f': ['ręce'],
  'subst:pl:gen:f': ['rąk'],
  'subst:pl:inst:f': ['rękami', 'rękoma'],
  'subst:pl:loc:f': ['rękach'],
}

const label = (tag: string) => {
  const CASES: Record<string, string> = {
    nom: 'именительный', gen: 'родительный', acc: 'винительный',
    inst: 'творительный', loc: 'предложный', dat: 'дательный', voc: 'звательный',
  }
  const p = tag.split(':')
  const num = p.includes('pl') ? 'мн. ч.' : 'ед. ч.'
  const c = p.find((x) => x in CASES)
  return `Поставьте в ${CASES[c ?? 'nom']} падеж, ${num}`
}

describe('детерминированность', () => {
  it('один seed — одно и то же упражнение', () => {
    const a = translateRecognition(reka, ['а', 'б', 'в', 'г'], CTX)
    const b = translateRecognition(reka, ['а', 'б', 'в', 'г'], CTX)
    expect(a.options).toEqual(b.options)
  })
  it('разный seed — разный порядок', () => {
    const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], 1)
    const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], 2)
    expect(a).not.toEqual(b)
  })
})

describe('лексические упражнения', () => {
  it('узнавание: 4 варианта, верный среди них', () => {
    const ex = translateRecognition(reka, ['нога', 'голова', 'глаз', 'ухо'], CTX)
    expect(ex.options).toHaveLength(4)
    expect(ex.options).toContain('рука')
    expect(ex.answer).toBe('рука')
  })

  it('воспроизведение дороже узнавания по времени и сложности', () => {
    const rec = translateRecognition(reka, ['а', 'б', 'в'], CTX)
    const prod = translateProduction(reka, ['dom', 'kot', 'stół'], CTX)
    expect(prod.difficulty).toBeGreaterThan(rec.difficulty)
    expect(prod.estimatedSec).toBeGreaterThan(rec.estimatedSec)
  })

  it('сборка по буквам сохраняет диакритику', () => {
    const ex = spelling(reka, CTX)
    expect(ex.letters.sort()).toEqual([...'ręka'].sort())
    expect(ex.answer).toBe('ręka')
  })

  it('ложный друг противопоставляется тому, чем кажется', () => {
    const ex = falseFriendContrast(sklep, CTX)!
    expect(ex.options).toContain('магазин')
    expect(ex.options).toContain('склеп')      // ← именно ловушка
    expect(ex.answer).toBe('магазин')
    expect(ex.explanation).toContain('grobowiec')
  })

  it('для обычного слова контраст не генерируется', () => {
    expect(falseFriendContrast(reka, CTX)).toBeNull()
  })
})

describe('грамматические упражнения из парадигмы', () => {
  it('дистракторы — настоящие формы того же слова, не мусор', () => {
    const ex = chooseForm('ręka', REKA, 'subst:pl:gen:f', label, CTX)!
    expect(ex.answer).toBe('rąk')
    const allForms = new Set(Object.values(REKA).flat())
    for (const o of ex.options) expect(allForms.has(o)).toBe(true)
  })

  it('верный вариант ровно один раз', () => {
    const ex = chooseForm('ręka', REKA, 'subst:sg:inst:f', label, CTX)!
    expect(ex.options.filter((o) => o === 'ręką')).toHaveLength(1)
  })

  it('инструкция расшифровывает тег', () => {
    const ex = chooseForm('ręka', REKA, 'subst:pl:gen:f', label, CTX)!
    expect(ex.instruction).toContain('родительный')
    expect(ex.instruction).toContain('мн. ч.')
  })

  it('открытое задание принимает оба варианта формы', () => {
    const ex = inflect('ręka', REKA, 'subst:pl:inst:f', label)!
    expect(ex.accepted).toEqual(['rękami', 'rękoma'])
    expect(check(ex, 'rękoma').correct).toBe(true)
    expect(check(ex, 'rękami').correct).toBe(true)
  })

  it('открытое задание сложнее закрытого', () => {
    const open = inflect('ręka', REKA, 'subst:pl:gen:f', label)!
    const closed = chooseForm('ręka', REKA, 'subst:pl:gen:f', label, CTX)!
    expect(open.difficulty).toBeGreaterThan(closed.difficulty)
  })

  it('пропуск в предложении', () => {
    const ex = gapFill('Mam dwie ___.', 'ręka', REKA, 'subst:pl:nom:f', label, CTX)!
    expect(ex.prompt).toContain('␣␣␣')
    expect(ex.answer).toBe('ręce')
  })

  it('не создаёт упражнение, где ответ равен начальной форме', () => {
    // «Поставьте ręka в именительный ед. ч.» → ответ написан в задании
    expect(chooseForm('ręka', REKA, 'subst:sg:nom:f', label, CTX)).toBeNull()
    expect(inflect('ręka', REKA, 'subst:sg:nom:f', label)).toBeNull()
    // а косвенный падеж — нормальное упражнение
    expect(chooseForm('ręka', REKA, 'subst:pl:gen:f', label, CTX)).not.toBeNull()
  })

  it('без парадигмы упражнение не создаётся', () => {
    expect(chooseForm('xyz', {}, 'subst:sg:nom:f', label, CTX)).toBeNull()
    expect(inflect('xyz', {}, 'subst:sg:nom:f', label)).toBeNull()
  })
})

describe('проверка ответа', () => {
  const ex = inflect('ręka', REKA, 'subst:pl:gen:f', label)!

  it('регистр и пробелы не важны', () => {
    expect(check(ex, '  RĄK ').correct).toBe(true)
  })

  it('потеря диакритики — ошибка, но ОТДЕЛЬНОГО вида', () => {
    const r = check(ex, 'rak')
    expect(r.correct).toBe(false)
    expect(r.errorKind).toBe('diacritic')   // форма выбрана верно, знак потерян
  })

  it('опечатка отличается от неверной формы', () => {
    expect(check(ex, 'rąkk').errorKind).toBe('typo')
    expect(check(ex, 'ręce').errorKind).toBe('wrong-form')
  })

  it('сборка по буквам тоже ловит диакритику', () => {
    const sp = spelling(reka, CTX)
    expect(check(sp, 'reka').errorKind).toBe('diacritic')
    expect(check(sp, 'ręka').correct).toBe(true)
  })

  it('выбор варианта: сравнение точное', () => {
    const ch = chooseForm('ręka', REKA, 'subst:pl:gen:f', label, CTX)!
    expect(check(ch, 'rąk').correct).toBe(true)
    expect(check(ch, 'ręce').correct).toBe(false)
  })
})
