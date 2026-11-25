import { check, chooseForm, inflect, type Exercise } from '@polski/engine'
import { loadGrammarSentences, loadMorphology, loadCollocations } from '@/lib/content/curriculum'
import { labelTag, RULE_TO_TAGS, resolveTag } from '@/lib/lang-pl/tags'
import { collocationDrills, sentenceDrillVariants, sentenceWriteDrills } from './exercises'
import { sourceExerciseId, type ReviewArchiveRow } from './assignment-progress'

/** Reconstruct from the current corpus and verify the saved expected answer.
 * Old index-based IDs cannot prove that the original prompt is unchanged.
 */
export async function restoreHistoricalExercise(id: string, row: ReviewArchiveRow): Promise<Exercise | null> {
  const source = sourceExerciseId(id)
  const gap = /^ex\.sgap\.(pl\.gram\..+)\.(\d+)\.(choice|typed)$/.exec(source)
  const write = /^ex\.swrite\.(pl\.gram\..+)\.(\d+)$/.exec(source)
  let exercise: Exercise | null | undefined
  if (gap) {
    const [,ruleId,index,mode] = gap
    const [sentences,morphology] = await Promise.all([loadGrammarSentences(),loadMorphology()])
    const item = sentences[ruleId]?.gaps[Number(index)]
    if (item) exercise = sentenceDrillVariants({ id: ruleId + '.' + index, sentence: item.pl, baseForm: item.lemma, answers: item.answers, distractors: item.distractors }, ruleId, morphology, row.dayNumber)[mode as 'choice'|'typed']
  } else if (write) {
    const [,ruleId] = write
    const sentences = await loadGrammarSentences()
    exercise = sentenceWriteDrills(ruleId, sentences, row.dayNumber, sentences[ruleId]?.responses?.length ?? 0).find(ex => ex.id === source)
  } else if (source.startsWith('ex.collocation.')) {
    const items = await loadCollocations()
    const item = items.find(item => item.slots.some(slot => source === 'ex.collocation.' + item.id + '.' + slot.id))
    if (item) exercise = collocationDrills(item, row.dayNumber).find(ex => ex.id === source)
  } else if (/^ex\.(form|infl)\./.test(source)) {
    const morphology = await loadMorphology()
    const prefix = source.startsWith('ex.form.') ? 'ex.form.' : 'ex.infl.'
    const body = source.slice(prefix.length)
    const split = body.lastIndexOf('.')
    if (split < 0) return null
    const lemma = body.slice(0,split), tag = body.slice(split+1)
    const paradigm = morphology[lemma.replace(/\s+się$/, '')]
    if (paradigm?.[tag]) {
      const rules = Object.entries(RULE_TO_TAGS).filter(([,prefixes]) => prefixes.some(p => resolveTag(paradigm,p) === tag)).map(([rule]) => rule)
      // Do not guess a grammar rule if more than one matches this form.
      const ruleIds = rules.length === 1 ? rules : []
      exercise = prefix === 'ex.form.' ? chooseForm(lemma, paradigm, tag, labelTag, { seed: row.dayNumber }, ruleIds) : inflect(lemma, paradigm, tag, labelTag, ruleIds)
    }
  }
  if (!exercise || exercise.id !== source || check(exercise, row.expected).expected !== row.expected || !check(exercise, row.expected).correct) return null
  return { ...exercise, id, attemptsAllowed: 1 }
}
