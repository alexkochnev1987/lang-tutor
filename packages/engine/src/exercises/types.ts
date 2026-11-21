/**
 * Типы упражнений.
 *
 * Движок языконезависим: он не знает, что такое «dopełniacz». Он работает
 * с тегами форм как с непрозрачными строками, а их расшифровка живёт в
 * языковом пакете. Поэтому тот же код обслужит немецкий или чешский.
 */

export type ExerciseKind =
  | 'pronunciation'            // произнести слово на изучаемом языке
  | 'translate-recognition'   // pl → ru, выбор из вариантов
  | 'translate-production'    // ru → pl, выбор или ввод
  | 'spelling'                // собрать слово из букв — тренирует диакритику
  | 'listen-write'            // услышать польское слово и вписать его
  | 'listen-choice'           // услышать польское слово и выбрать перевод
  | 'inflect'                 // образовать форму: открытое задание экзамена
  | 'choose-form'             // выбрать верную форму — закрытое задание
  | 'gap-fill'                // вставить слово в предложение
  | 'false-friend-contrast'   // контраст с русским ложным другом
  | 'sentence-choice'         // предложение с пропуском: выбор из 4 вариантов
  | 'sentence-typed'          // предложение с пропуском: слово вписывается
  | 'sentence-write'          // написать предложение целиком (ответ на вопрос)
  | 'collocation-guided'      // пошагово собрать сочетание: один слот за раз
  | 'reading-choice'          // текст для чтения с вопросом и вариантами ответа

export type AnswerMode = 'choice' | 'typed' | 'assemble'

export interface ExerciseBase {
  id: string
  kind: ExerciseKind
  /** 1..5 — идёт в mastery-модель как вес наблюдения */
  difficulty: number
  /** Что проверяется: id лексемы и/или правила */
  lexemeId?: string
  grammarRuleIds: string[]
  /** Модуль экзамена, на который работает упражнение */
  moduleId: string
  /** Сколько секунд закладываем */
  estimatedSec: number
  /** Tries before the correct answer is revealed; absent means one. */
  attemptsAllowed?: number
  /** Метаданные для адаптивных сочетаний и предложений. */
  sentenceId?: string
  templateId?: string
  slotIndex?: number
  tokenId?: string
  /** Ключ — вариант ответа, значение — типичные ошибки этого варианта. */
  optionErrorTags?: Record<string, string[]>
}

export interface ChoiceExercise extends ExerciseBase {
  mode: 'choice'
  prompt: string
  /** Базовая форма слова, если ответ образуется прямо в строке. */
  baseForm?: string
  /** Отдельный текст для comprehension-задания: вопрос меняется, текст остаётся. */
  readingText?: string
  /** Подсказка над заданием: «Выберите перевод», «Родительный падеж мн. ч.» */
  instruction: string
  options: string[]
  answer: string
  /** Что сказать после неверного ответа */
  explanation?: string
  /** Перевод/смысл, который можно показать отдельно от польского контекста. */
  translation?: string
  /** Текст до и после текущего слота в пошаговой сборке. */
  contextBefore?: string
  contextAfter?: string
  /** Полный текст для озвучивания после ответа. */
  speakText?: string
}

export interface TypedExercise extends ExerciseBase {
  mode: 'typed'
  prompt: string
  /** Базовая форма слова, если ответ образуется прямо в строке. */
  baseForm?: string
  instruction: string
  /** Принимаемые ответы — вариантов может быть несколько (rękami / rękoma) */
  accepted: string[]
  /** Текст, который приложение произносит в аудио-задании. */
  speakText?: string
  explanation?: string
}

export interface AssembleExercise extends ExerciseBase {
  mode: 'assemble'
  prompt: string
  instruction: string
  /** Буквы вперемешку */
  letters: string[]
  answer: string
}

export type Exercise = ChoiceExercise | TypedExercise | AssembleExercise

/** Парадигма: тег формы → варианты. Приходит из языкового пакета. */
export type Paradigm = Record<string, string[]>

export interface ExerciseContext {
  /** Детерминированный источник «случайности»: один и тот же вход даёт
   *  один и тот же вариант. Иначе упражнения нельзя тестировать. */
  seed: number
}
