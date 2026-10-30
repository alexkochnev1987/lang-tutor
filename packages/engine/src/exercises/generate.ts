/**
 * Генераторы упражнений.
 *
 * Принцип, ради которого всё это: **дистракторы берутся из настоящей
 * парадигмы того же слова.** Случайные варианты учат узнавать мусор;
 * реальные формы заставляют различать `ręce` / `ręką` / `rąk` — ровно то,
 * что проверяет открытая часть модуля «Poprawność gramatyczna».
 */
import type {
  AssembleExercise, ChoiceExercise, Exercise, ExerciseContext, Paradigm, TypedExercise,
} from './types'

/** Детерминированный ГПСЧ: одинаковый вход — одинаковое упражнение. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

export function shuffle<T>(arr: readonly T[], seed: number): T[] {
  const a = [...arr]
  const r = rng(seed)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export const hashString = (s: string): number =>
  [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7) >>> 0

// ─────────────────────────────────────────────────────────────────────
// Лексика
// ─────────────────────────────────────────────────────────────────────

export interface LexemeLike {
  id: string
  lemma: string
  translation: string
  transparency: string
  interference?: { confusedWith: string; actuallyIs: string }
  grammarRuleIds?: string[]
}

export function translateRecognition(
  word: LexemeLike, pool: readonly string[], ctx: ExerciseContext,
): ChoiceExercise {
  const distractors = shuffle(pool.filter((t) => t !== word.translation), ctx.seed).slice(0, 3)
  return {
    id: `ex.rec.${word.id}`,
    kind: 'translate-recognition',
    mode: 'choice',
    difficulty: 1,
    lexemeId: word.id,
    grammarRuleIds: [],
    moduleId: 'reading',
    estimatedSec: 8,
    instruction: 'Wybierz tłumaczenie',
    prompt: word.lemma,
    options: shuffle([word.translation, ...distractors], ctx.seed + 1),
    answer: word.translation,
  }
}

export function translateProduction(
  word: LexemeLike, pool: readonly string[], ctx: ExerciseContext,
): ChoiceExercise {
  const distractors = shuffle(pool.filter((l) => l !== word.lemma), ctx.seed).slice(0, 3)
  return {
    id: `ex.prod.${word.id}`,
    kind: 'translate-production',
    mode: 'choice',
    difficulty: 2,
    lexemeId: word.id,
    grammarRuleIds: [],
    moduleId: 'writing',
    estimatedSec: 12,
    instruction: 'Jak to powiedzieć po polsku?',
    prompt: word.translation,
    options: shuffle([word.lemma, ...distractors], ctx.seed + 1),
    answer: word.lemma,
  }
}

/**
 * Сборка слова из букв. Главная цель — диакритика: разница между
 * `może` и `morze`, `laska` и `łaska` проходит именно по этим знакам.
 */
export function spelling(word: LexemeLike, ctx: ExerciseContext): AssembleExercise {
  return {
    id: `ex.spell.${word.id}`,
    kind: 'spelling',
    mode: 'assemble',
    difficulty: 3,
    lexemeId: word.id,
    grammarRuleIds: ['pl.gram.alphabet-orthography'],
    moduleId: 'writing',
    estimatedSec: 20,
    instruction: 'Ułóż słowo z liter',
    prompt: word.translation,
    letters: shuffle([...word.lemma.replace(/\s/g, '')], ctx.seed),
    answer: word.lemma.replace(/\s/g, ''),
  }
}

/**
 * Одно аудио-задание: приложение произносит польское слово, а учащийся
 * записывает услышанное. Отдельный этап «произнести слово» не создаём —
 * произношение является частью этого задания.
 */
export function listenWrite(word: LexemeLike): TypedExercise {
  return {
    id: `ex.listen-write.${word.id}`,
    kind: 'listen-write',
    mode: 'typed',
    difficulty: 4,
    lexemeId: word.id,
    grammarRuleIds: [],
    moduleId: 'listening',
    estimatedSec: 20,
    instruction: 'Posłuchaj i wpisz słowo',
    prompt: word.translation,
    accepted: [word.lemma],
    speakText: word.lemma,
  }
}

/**
 * Контраст с ложным другом. Обычная карточка тут не работает: ошибка не
 * в незнании, а в ложном знании, которое надо активно перебить.
 */
export function falseFriendContrast(
  word: LexemeLike, ctx: ExerciseContext,
): ChoiceExercise | null {
  if (!word.interference) return null
  const { confusedWith, actuallyIs } = word.interference
  const options = shuffle(
    [word.translation, confusedWith, actuallyIs, '—'].filter((x) => x !== '—'),
    ctx.seed)
  return {
    id: `ex.ff.${word.id}`,
    kind: 'false-friend-contrast',
    mode: 'choice',
    difficulty: 4,
    lexemeId: word.id,
    grammarRuleIds: [],
    moduleId: 'reading',
    estimatedSec: 12,
    instruction: 'Uwaga: fałszywy przyjaciel',
    prompt: word.lemma,
    options,
    answer: word.translation,
    explanation: `„${confusedWith}” po polsku to „${actuallyIs}”.`,
  }
}

// ─────────────────────────────────────────────────────────────────────
// Грамматика: дистракторы из настоящей парадигмы
// ─────────────────────────────────────────────────────────────────────

/** Человекочитаемая подпись тега. Приходит из языкового пакета. */
export type TagLabeller = (tag: string) => string

export function chooseForm(
  lemma: string, paradigm: Paradigm, targetTag: string,
  label: TagLabeller, ctx: ExerciseContext, ruleIds: string[] = [],
): ChoiceExercise | null {
  const answers = paradigm[targetTag]
  if (!answers?.length) return null
  const answer = answers[0]!
  // Если целевая форма совпадает с начальной, упражнения нет: ответ
  // написан в самом задании. Пропускаем — пусть вызывающий возьмёт
  // другой тег.
  if (answer === lemma) return null

  // дистракторы — ДРУГИЕ реальные формы того же слова
  const others = Object.entries(paradigm)
    .filter(([tag]) => tag !== targetTag)
    .flatMap(([, forms]) => forms)
    .filter((f) => f !== answer)
  const unique = [...new Set(others)]
  if (unique.length < 2) return null

  const distractors = shuffle(unique, ctx.seed).slice(0, 3)
  return {
    id: `ex.form.${lemma}.${targetTag}`,
    kind: 'choose-form',
    mode: 'choice',
    difficulty: 3,
    grammarRuleIds: ruleIds,
    moduleId: 'grammar',
    estimatedSec: 15,
    instruction: label(targetTag),
    baseForm: lemma,
    prompt: lemma,
    options: shuffle([answer, ...distractors], ctx.seed + 1),
    answer,
  }
}

/**
 * Открытое задание: образовать форму самостоятельно.
 * Именно такие задания на экзамене имеют большую различительную силу —
 * понятные, но неверные формы баллов не получают.
 */
export function inflect(
  lemma: string, paradigm: Paradigm, targetTag: string,
  label: TagLabeller, ruleIds: string[] = [],
): TypedExercise | null {
  const accepted = paradigm[targetTag]
  if (!accepted?.length) return null
  if (accepted.length === 1 && accepted[0] === lemma) return null
  return {
    id: `ex.infl.${lemma}.${targetTag}`,
    kind: 'inflect',
    mode: 'typed',
    difficulty: 5,
    grammarRuleIds: ruleIds,
    moduleId: 'grammar',
    estimatedSec: 25,
    instruction: label(targetTag),
    baseForm: lemma,
    prompt: lemma,
    accepted: [...accepted],
  }
}

export function gapFill(
  sentence: string, blankFor: string, paradigm: Paradigm, targetTag: string,
  label: TagLabeller, ctx: ExerciseContext, ruleIds: string[] = [],
): ChoiceExercise | null {
  const answers = paradigm[targetTag]
  if (!answers?.length) return null
  const answer = answers[0]!
  const others = [...new Set(Object.entries(paradigm)
    .filter(([t]) => t !== targetTag).flatMap(([, f]) => f))]
    .filter((f) => f !== answer)
  if (others.length < 2) return null

  return {
    id: `ex.gap.${blankFor}.${targetTag}`,
    kind: 'gap-fill',
    mode: 'choice',
    difficulty: 4,
    grammarRuleIds: ruleIds,
    moduleId: 'grammar',
    estimatedSec: 18,
    instruction: `Wstaw odpowiednią formę słowa „${blankFor}”`,
    baseForm: blankFor,
    prompt: sentence.replace('___', '␣␣␣'),
    options: shuffle([answer, ...shuffle(others, ctx.seed).slice(0, 3)], ctx.seed + 1),
    answer,
    explanation: label(targetTag),
  }
}

// ─────────────────────────────────────────────────────────────────────
// Sentence-based exercises: pre-authored content from the language pack
// ─────────────────────────────────────────────────────────────────────

const GAP_MARK = '␣␣␣'

export const SENTENCE_ATTEMPTS = 3

export interface SentenceGapLike {
  id: string
  /** Contains exactly one `___` gap */
  sentence: string
  /** Лемма пропущенного слова — показывается рядом с inline-полем. */
  baseForm?: string
  answers: string[]
  /** Hand-vetted to be ungrammatical in this context — a random paradigm
   *  form can't guarantee that: it sometimes fits the sentence too. */
  distractors?: string[]
  translation?: string
}

export function sentenceChoice(
  item: SentenceGapLike, paradigmForms: readonly string[], ctx: ExerciseContext,
  ruleIds: string[] = [],
): ChoiceExercise | null {
  const answer = item.answers[0]
  if (!answer) return null
  const banned = new Set(item.answers.map((a) => a.toLowerCase()))
  const pool = [...(item.distractors ?? []), ...shuffle(paradigmForms, ctx.seed)]
  const distractors: string[] = []
  for (const d of pool) {
    if (banned.has(d.toLowerCase()) || distractors.includes(d)) continue
    distractors.push(d)
    if (distractors.length === 3) break
  }
  if (distractors.length < 3) return null
  return {
    id: `ex.sgap.${item.id}.choice`,
    kind: 'sentence-choice',
    mode: 'choice',
    difficulty: 3,
    grammarRuleIds: ruleIds,
    moduleId: 'grammar',
    estimatedSec: 15,
    attemptsAllowed: SENTENCE_ATTEMPTS,
    instruction: 'Wybierz słowo do luki',
    baseForm: item.baseForm,
    prompt: item.sentence.replace('___', GAP_MARK),
    options: shuffle([answer, ...distractors], ctx.seed + 1),
    answer,
    explanation: item.translation,
  }
}

export function sentenceTyped(
  item: SentenceGapLike, ruleIds: string[] = [],
): TypedExercise | null {
  if (!item.answers.length) return null
  return {
    id: `ex.sgap.${item.id}.typed`,
    kind: 'sentence-typed',
    mode: 'typed',
    difficulty: 4,
    grammarRuleIds: ruleIds,
    moduleId: 'grammar',
    estimatedSec: 20,
    attemptsAllowed: SENTENCE_ATTEMPTS,
    instruction: 'Wpisz słowo w lukę',
    baseForm: item.baseForm,
    prompt: item.sentence.replace('___', GAP_MARK),
    accepted: [...item.answers],
    explanation: item.translation,
  }
}

export interface SentenceResponseLike {
  id: string
  question: string
  answers: string[]
  instruction?: string
  translation?: string
}

export function sentenceWrite(
  item: SentenceResponseLike, ruleIds: string[] = [],
): TypedExercise | null {
  if (!item.answers.length) return null
  return {
    id: `ex.swrite.${item.id}`,
    kind: 'sentence-write',
    mode: 'typed',
    difficulty: 5,
    grammarRuleIds: ruleIds,
    moduleId: 'grammar',
    estimatedSec: 40,
    attemptsAllowed: SENTENCE_ATTEMPTS,
    instruction: item.instruction ?? 'Napisz odpowiedź pełnym zdaniem',
    prompt: item.question,
    accepted: [...item.answers],
    explanation: item.translation,
  }
}

// ─────────────────────────────────────────────────────────────────────
// Reading: pre-authored Polish text with a comprehension question
// ─────────────────────────────────────────────────────────────────────

export interface ReadingChoiceLike {
  id: string
  text: string
  question: string
  options: string[]
  answer: string
  explanation?: string
  difficulty?: number
}

export function readingChoice(
  item: ReadingChoiceLike, ctx: ExerciseContext,
): ChoiceExercise | null {
  if (!item.text || !item.question || item.options.length < 2) return null
  if (!item.options.includes(item.answer)) return null
  const options = shuffle(item.options, ctx.seed)
  return {
    id: `ex.reading.${item.id}`,
    kind: 'reading-choice',
    mode: 'choice',
    difficulty: item.difficulty ?? 3,
    grammarRuleIds: [],
    moduleId: 'reading',
    estimatedSec: 35,
    instruction: 'Przeczytaj tekst i wybierz poprawną odpowiedź',
    prompt: item.question,
    readingText: item.text,
    options,
    answer: item.answer,
    explanation: item.explanation,
  }
}

// ─────────────────────────────────────────────────────────────────────
// Проверка ответа
// ─────────────────────────────────────────────────────────────────────

export interface CheckResult {
  correct: boolean
  /** Что именно не так — нужно для разбора и для статистики ошибок */
  errorKind?: 'wrong-form' | 'diacritic' | 'typo' | 'wrong-word'
  expected: string
}

/** Нормализация для сравнения: регистр и лишние пробелы. Диакритика — НЕТ. */
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/** Full sentences also forgive punctuation: the exam grades word forms. */
const normSentence = (s: string) =>
  norm(s).replace(/[.,!?…;:„”"']+/g, ' ').replace(/\s+/g, ' ').trim()

/** Снятие диакритики — только чтобы отличить её потерю от другой ошибки. */
const DIACRITIC_MAP: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
}
const stripDiacritics = (s: string) =>
  s.replace(/[ąćęłńóśźż]/g, (c) => DIACRITIC_MAP[c] ?? c)

export function check(ex: Exercise, answer: string): CheckResult {
  if (ex.mode === 'choice') {
    return { correct: norm(answer) === norm(ex.answer), expected: ex.answer }
  }
  if (ex.mode === 'assemble') {
    return {
      correct: norm(answer) === norm(ex.answer),
      expected: ex.answer,
      errorKind: norm(answer) === norm(ex.answer) ? undefined
        : stripDiacritics(norm(answer)) === stripDiacritics(norm(ex.answer))
          ? 'diacritic' : 'typo',
    }
  }
  // typed
  const normT = ex.kind === 'sentence-write' ? normSentence : norm
  const a = normT(answer)
  if (ex.accepted.some((x) => normT(x) === a)) {
    return { correct: true, expected: ex.accepted[0]! }
  }
  // диакритика потеряна — отдельная ошибка: на экзамене её засчитывают как ошибку,
  // но учащемуся полезно знать, что форму он выбрал верно
  if (ex.accepted.some((x) => stripDiacritics(normT(x)) === stripDiacritics(a))) {
    return { correct: false, errorKind: 'diacritic', expected: ex.accepted[0]! }
  }
  const typoBudget = ex.kind === 'sentence-write' ? 2 : 1
  const close = ex.accepted.some((x) => levenshtein(normT(x), a) <= typoBudget)
  return {
    correct: false,
    errorKind: close ? 'typo' : 'wrong-form',
    expected: ex.accepted[0]!,
  }
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0]!
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!
      prev[j] = Math.min(
        prev[j]! + 1, prev[j - 1]! + 1,
        last + (a[i - 1] === b[j - 1] ? 0 : 1))
      last = tmp
    }
  }
  return prev[b.length]!
}

export const _internal = { levenshtein, stripDiacritics }
