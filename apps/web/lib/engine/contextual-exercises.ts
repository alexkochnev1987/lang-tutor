import { hashString, sentenceChoice, sentenceTyped, shuffle, type Exercise } from '@polski/engine'
import { loadGrammarSentences, type SentencePack } from '@/lib/content/curriculum'
import { closedClassWordsForRule } from '@/lib/lang-pl/closed-class'
import { RULE_TO_TAGS } from '@/lib/lang-pl/tags'

export function isLegacyForm(exercise: Exercise) {
  return exercise.kind === 'choose-form' || exercise.kind === 'inflect'
}

export function sentenceSourceKey(exercise: Exercise) {
  return exercise.prompt.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl')
}

/** Only reviewed distractors are suitable for a contextual choice. */
export function contextualDrills(pack: SentencePack, ruleId: string, mode: 'choice' | 'typed', seed: number): Exercise[] {
  const gaps = pack[ruleId]?.gaps ?? []
  return shuffle(gaps.map((_, index) => index), seed + hashString(ruleId)).flatMap(index => {
    const gap = gaps[index]
    if (!gap || gap.pl.split('___').length !== 2 || !gap.answers.some(answer => answer.trim())) return []
    const item = {
      id: ruleId + '.' + index, sentence: gap.pl, baseForm: gap.lemma,
      answers: gap.answers, distractors: gap.distractors, translation: gap.ru,
    }
    const ex = mode === 'choice' ? sentenceChoice(item, [], { seed: seed + hashString(item.id) }, [ruleId]) : sentenceTyped(item, [ruleId])
    return ex ? [ex] : []
  })
}

const normalize = (value: string) => value.trim().normalize('NFC').toLocaleLowerCase('pl')
const canonicalId = (id: string) => id.startsWith('grammar-practice:') ? id.slice('grammar-practice:'.length) : id

/** Keep the persisted slot ID for backwards compatibility. templateId records
 * the new content ID; the original snapshot and attempt history stay intact.
 * A historical ID alone does not always identify a rule: never guess mastery. */
export async function contextualizeLegacy(id: string, day: number, ruleIds: readonly string[] = [], expected: readonly string[] = [], used: ReadonlySet<string> = new Set()): Promise<Exercise | null> {
  const match = /^ex\.(form|infl)\.(.+?)\.([a-z0-9]+:.+)$/.exec(canonicalId(id))
  if (!match) return null
  const [, kind, lemma, tag] = match
  if (!lemma || !tag) return null
  const possible = Object.entries(RULE_TO_TAGS).filter(([, prefixes]) => prefixes.some(prefix => tag.startsWith(prefix))).map(([rule]) => rule)
  const closed = possible.filter(rule => closedClassWordsForRule(rule).some(word => word.lemma === lemma))
  const rules = ruleIds.length ? [...ruleIds] : closed.length === 1 ? closed : possible
  const pack = await loadGrammarSentences()
  const seed = hashString(id + ':' + day)
  const mode = kind === 'form' ? 'choice' : 'typed'
  const candidates = rules.flatMap(rule => contextualDrills(pack, rule, mode, seed))
    .filter(ex => !used.has(sentenceSourceKey(ex)))
  const forms = new Set(expected.map(normalize))
  const exact = candidates.filter(ex => ex.mode !== 'assemble' && normalize(ex.baseForm ?? '') === normalize(lemma) &&
    (ex.mode === 'choice' ? [ex.answer] : ex.accepted).some(answer => forms.has(normalize(answer))))
  // If the original rule is unknown and ambiguous, only an exact lemma/form
  // match is usable; a generic substitution would teach an unrelated rule.
  const fallback = rules.length === 1 ? candidates : []
  const chosen = exact[0] ?? fallback.find(ex => ex.mode !== 'assemble' && normalize(ex.baseForm ?? '') === normalize(lemma)) ?? fallback[0]
  if (!chosen) return null
  return { ...chosen, id, templateId: chosen.id, grammarRuleIds: ruleIds.length ? [...ruleIds] : rules.length === 1 ? rules : [] }
}

export function legacyExpected(exercise: Exercise): string[] {
  return exercise.mode === 'typed' ? exercise.accepted : [exercise.answer]
}
