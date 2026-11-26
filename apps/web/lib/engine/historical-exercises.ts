import { check, type Exercise } from '@polski/engine'
import { loadGrammarSentences, loadMorphology, loadCollocations } from '@/lib/content/curriculum'
import { contextualizeLegacy } from './contextual-exercises'
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
    const replacement = await contextualizeLegacy(id, row.dayNumber, [], [row.expected])
    return replacement ? { ...replacement, attemptsAllowed: 1 } : null
  }
  if (!exercise || exercise.id !== source || check(exercise, row.expected).expected !== row.expected || !check(exercise, row.expected).correct) return null
  return { ...exercise, id, attemptsAllowed: 1 }
}
