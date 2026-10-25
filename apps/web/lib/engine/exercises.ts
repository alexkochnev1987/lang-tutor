/**
 * Сборка конкретных упражнений занятия.
 *
 * Движок умеет ГЕНЕРИРОВАТЬ упражнения, но не знает, из чего. Здесь
 * соединяются: план дня, словарь, морфология и польский плагин.
 */
import {
  chooseForm, falseFriendContrast, inflect, sentenceChoice, sentenceTyped,
  sentenceWrite, shuffle, spelling, translateProduction, translateRecognition,
  type Exercise, type SentenceGapLike,
} from '@polski/engine'
import { closedClassWordsForRule } from '@/lib/lang-pl/closed-class'
import { labelTag, RULE_TO_TAGS, resolveTag } from '@/lib/lang-pl/tags'
import type { Lexeme, Paradigm, SentencePack } from '@/lib/content/curriculum'
import type { StudyItemKind } from '@/lib/data/types'

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7) >>> 0

/** Что генератору нужно от слова: лемма для парадигмы и id для сида. */
export type WordRef = Pick<Lexeme, 'id' | 'lemma'>

export interface BuildInput {
  newWords: Lexeme[]
  reviewWords: Lexeme[]
  grammarRuleIds: string[]
  vocabulary: Map<string, Lexeme>
  morphology: Record<string, Paradigm>
}

/** Упражнения на новое слово: от узнавания к продукции. */
export function exercisesForWord(word: Lexeme, pool: Lexeme[]): Exercise[] {
  const seed = hash(word.id)
  const out: Exercise[] = []

  // ложный друг идёт контрастом вместо обычного узнавания
  const ff = falseFriendContrast(word, { seed })
  out.push(ff ?? translateRecognition(word, pool.map((p) => p.translation), { seed }))

  // продукция — только для ядра; тематику держим на узнавании (VOCABULARY.md §2)
  if (word.priority !== 'normal') {
    out.push(translateProduction(word, pool.map((p) => p.lemma), { seed: seed + 7 }))
  }
  // диакритика: если в слове есть особые знаки, стоит собрать по буквам
  if (/[ąćęłńóśźż]/.test(word.lemma) && word.lemma.length <= 12) {
    out.push(spelling(word, { seed: seed + 13 }))
  }
  return out
}

/**
 * Упражнение на повторение уже введённого слова.
 *
 * Два отличия от первого знакомства:
 *
 * 1. Тип определяется карточкой, а не словом. Узнавание (pl → ru) и
 *    воспроизведение (ru → pl) — разные карточки с разными кривыми
 *    забывания, и повторять надо ровно ту, которая подошла по сроку.
 * 2. **Примеры каждый раз новые.** Сид сдвигается на число повторений,
 *    поэтому дистракторы и выбранная форма меняются от раза к разу.
 *    Иначе человек запоминает не слово, а расположение правильного
 *    варианта в списке.
 */
export function exerciseForReview(
  word: Lexeme, kind: StudyItemKind, reps: number, pool: Lexeme[],
): Exercise | null {
  // 101 — просто нечётный множитель: даёт заметно разные сиды на
  // соседних повторениях, а не сдвиг на единицу
  const seed = hash(word.id) + reps * 101

  if (kind === 'lexeme-production') {
    return translateProduction(word, pool.map((p) => p.lemma), { seed })
  }
  // ложный друг и на повторении идёт контрастом: это самая дорогая ошибка
  return falseFriendContrast(word, { seed })
    ?? translateRecognition(word, pool.map((p) => p.translation), { seed })
}

/** Грамматические упражнения по правилу — на лексике, которую уже знают. */
export function exercisesForRule(
  ruleId: string,
  words: readonly WordRef[],
  morphology: Record<string, Paradigm>,
  limit = 3,
): Exercise[] {
  const prefixes = RULE_TO_TAGS[ruleId]
  if (!prefixes?.length) return []

  // Закрытый класс — это конкретные слова, а не лексика дня: правило
  // «личные местоимения» про `ja` и `on`, и подставлять туда слова урока
  // бессмысленно. Если список задан, он пул и заменяет.
  const closed = closedClassWordsForRule(ruleId)
  const pool: readonly WordRef[] = closed.length ? closed : words

  const out: Exercise[] = []
  const used = new Set<string>()

  // Проходов несколько. Первый берёт по одному заданию со слова — в
  // уроке лучше три разных слова, чем три формы одного. Следующие
  // добирают другие формы тех же слов: закрытый класс бывает и из
  // одной леммы (`siebie`, `być`), и одним заданием там не обойтись.
  for (let pass = 0; pass < limit && out.length < limit; pass++) {
    for (const w of pool) {
      if (out.length >= limit) break
      const paradigm = morphology[w.lemma.replace(/\s+się$/, '')]
      if (!paradigm) continue
      for (const prefix of prefixes) {
        const tag = resolveTag(paradigm, prefix)
        if (!tag || used.has(`${w.lemma}|${tag}`)) continue
        const seed = hash(w.id + tag)
        // Закрытое и открытое чередуем: на экзамене есть оба типа.
        // Генератор вернёт null, если целевая форма равна начальной —
        // тогда пробуем следующий тег.
        const ex = out.length % 2 === 0
          ? chooseForm(w.lemma, paradigm, tag, labelTag, { seed }, [ruleId])
          : inflect(w.lemma, paradigm, tag, labelTag, [ruleId])
        if (ex) { used.add(`${w.lemma}|${tag}`); out.push(ex); break }
      }
    }
  }
  return out
}

export type SentenceMode = 'choice' | 'typed'

export interface SentenceDrill {
  ex: Exercise
  variants: Partial<Record<SentenceMode, Exercise>>
}

export function sentenceDrillsForRule(
  ruleId: string,
  sentences: SentencePack,
  morphology: Record<string, Paradigm>,
  mode: SentenceMode,
  salt: number,
  limit: number,
): SentenceDrill[] {
  const gaps = sentences[ruleId]?.gaps ?? []
  if (!gaps.length) return []
  const order = shuffle(gaps.map((_, i) => i), hash(ruleId) + salt).slice(0, limit)
  const out: SentenceDrill[] = []
  for (const idx of order) {
    const g = gaps[idx]!
    const item: SentenceGapLike = {
      id: `${ruleId}.${idx}`,
      sentence: g.pl,
      answers: g.answers,
      distractors: g.distractors,
      translation: g.ru,
    }
    const paradigm = g.lemma ? morphology[g.lemma] : undefined
    const forms = paradigm ? [...new Set(Object.values(paradigm).flat())] : []
    const variants: Partial<Record<SentenceMode, Exercise>> = {}
    const choice = sentenceChoice(item, forms, { seed: hash(item.id) + salt }, [ruleId])
    const typed = sentenceTyped(item, [ruleId])
    if (choice) variants.choice = choice
    if (typed) variants.typed = typed
    const ex = variants[mode] ?? choice ?? typed
    if (ex) out.push({ ex, variants })
  }
  return out
}

export function sentenceWriteDrills(
  ruleId: string, sentences: SentencePack, salt: number, limit: number,
): Exercise[] {
  const responses = sentences[ruleId]?.responses ?? []
  const order = shuffle(responses.map((_, i) => i), hash(`${ruleId}.w`) + salt).slice(0, limit)
  const out: Exercise[] = []
  for (const idx of order) {
    const r = responses[idx]!
    const ex = sentenceWrite({
      id: `${ruleId}.${idx}`,
      question: r.question,
      answers: r.answers,
      instruction: r.hint,
      translation: r.ru,
    }, [ruleId])
    if (ex) out.push(ex)
  }
  return out
}
