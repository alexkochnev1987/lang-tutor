import type { GrammarRule } from './curriculum'

export const RULE_LANGUAGES = ['ru', 'uk', 'en', 'pl'] as const
export type RuleLanguage = (typeof RULE_LANGUAGES)[number]

export const RULE_LANGUAGE_NAMES: Record<RuleLanguage, string> = {
  ru: 'Русский',
  uk: 'Українська',
  en: 'English',
  pl: 'Polski',
}

export const PACK_ORIGINAL_LANGUAGE: RuleLanguage = 'ru'

export function isRuleLanguage(v: unknown): v is RuleLanguage {
  return typeof v === 'string' && (RULE_LANGUAGES as readonly string[]).includes(v)
}

export interface LocalizedExample {
  pl: string
  gloss: string
}

export interface LocalizedRule {
  id: string
  category: string
  titlePl: string
  title: string
  summary: string
  examples: LocalizedExample[]
  pitfalls: string[]
  teachingNote: string | null
  difficulty: number
  interferenceRu: number
  showsOriginalInstead: boolean
}

export function localizeRule(rule: GrammarRule, lang: RuleLanguage): LocalizedRule {
  const original = PACK_ORIGINAL_LANGUAGE
  const isOriginal = lang === original

  const translatedSummary = rule.summaryI18n?.[lang] ?? (isOriginal ? rule.summary : null)
  const translatedPitfalls = rule.pitfallsI18n?.[lang]
    ?? (isOriginal ? rule.pitfallsForRu : null)
  const translatedNote = rule.teachingNoteI18n?.[lang]
    ?? (isOriginal ? rule.teachingNote ?? null : null)

  return {
    id: rule.id,
    category: rule.category,
    titlePl: rule.title.pl ?? rule.id,
    title: rule.title[lang] ?? rule.title[original] ?? rule.id,
    summary: translatedSummary ?? rule.summary,
    examples: rule.examples.map((e) => ({
      pl: e.pl ?? '',
      gloss: e[lang] ?? e[original] ?? '',
    })),
    pitfalls: translatedPitfalls ?? rule.pitfallsForRu ?? [],
    teachingNote: translatedNote ?? rule.teachingNote ?? null,
    difficulty: rule.difficulty,
    interferenceRu: rule.interferenceRu,
    showsOriginalInstead: !isOriginal && translatedSummary === null,
  }
}
