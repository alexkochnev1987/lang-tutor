/**
 * Сборка конкретных упражнений занятия.
 *
 * Движок умеет ГЕНЕРИРОВАТЬ упражнения, но не знает, из чего. Здесь
 * соединяются: план дня, словарь, морфология и польский плагин.
 */
import {
  chooseForm, falseFriendContrast, inflect, spelling,
  translateProduction, translateRecognition,
  type Exercise,
} from '@polski/engine'
import { labelTag, RULE_TO_TAGS, resolveTag } from '@/lib/lang-pl/tags'
import type { Lexeme, Paradigm } from '@/lib/content/curriculum'
import type { StudyItemKind } from '@/lib/data/types'

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7) >>> 0

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
  ruleId: string, words: Lexeme[], morphology: Record<string, Paradigm>, limit = 3,
): Exercise[] {
  const prefixes = RULE_TO_TAGS[ruleId]
  if (!prefixes?.length) return []

  const out: Exercise[] = []
  for (const w of words) {
    if (out.length >= limit) break
    const paradigm = morphology[w.lemma.replace(/\s+się$/, '')]
    if (!paradigm) continue
    for (const prefix of prefixes) {
      const tag = resolveTag(paradigm, prefix)
      if (!tag) continue
      const seed = hash(w.id + tag)
      // Закрытое и открытое чередуем: на экзамене есть оба типа.
      // Генератор вернёт null, если целевая форма равна начальной —
      // тогда пробуем следующий тег.
      const ex = out.length % 2 === 0
        ? chooseForm(w.lemma, paradigm, tag, labelTag, { seed }, [ruleId])
        : inflect(w.lemma, paradigm, tag, labelTag, [ruleId])
      if (ex) { out.push(ex); break }
    }
  }
  return out
}
