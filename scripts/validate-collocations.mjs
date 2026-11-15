#!/usr/bin/env node
/**
 * Проверяет collocations.json как контентный контракт, а не как генератор
 * грамматической истины: семантическая пригодность дистракторов остаётся
 * ручной редакторской проверкой.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'content/pl-b1-ru')
const rules = JSON.parse(readFileSync(join(dir, 'grammar-rules.json'), 'utf8')).rules
const ruleIds = new Set(rules.map((rule) => rule.id))
const vocabulary = JSON.parse(readFileSync(join(dir, 'vocabulary.json'), 'utf8')).items
const lexemeIds = new Set(vocabulary.map((word) => word.id))
const pack = JSON.parse(readFileSync(join(dir, 'collocations.json'), 'utf8'))

const errors = []
const lower = (value) => String(value).trim().toLocaleLowerCase()
const items = pack.items ?? []

if (!Array.isArray(items)) errors.push('items должен быть массивом')

for (const [itemIndex, item] of items.entries()) {
  const at = `items[${itemIndex}]`
  if (!item.id?.trim()) errors.push(`${at}: нет id`)
  if (!item.translation?.trim()) errors.push(`${at}: нет русского перевода`)
  if (!Array.isArray(item.slots) || item.slots.length < 2 || item.slots.length > 3) {
    errors.push(`${at}: должно быть от 2 до 3 слотов`)
    continue
  }

  for (const [slotIndex, slot] of item.slots.entries()) {
    const slotAt = `${at}.slots[${slotIndex}]`
    if (!slot.id?.trim() || !slot.token?.trim()) errors.push(`${slotAt}: нет id или token`)
    if (!Array.isArray(slot.ruleIds) || slot.ruleIds.length === 0) {
      errors.push(`${slotAt}: у каждого слова должно быть хотя бы одно правило`)
    }
    for (const ruleId of slot.ruleIds ?? []) {
      if (!ruleIds.has(ruleId)) errors.push(`${slotAt}: неизвестное правило ${ruleId}`)
    }
    if (slot.lexemeId && !lexemeIds.has(slot.lexemeId)) {
      errors.push(`${slotAt}: неизвестная лексема ${slot.lexemeId}`)
    }

    const distractors = slot.distractors ?? []
    if (distractors.length < 3) {
      errors.push(`${slotAt}: нужно минимум 3 дистрактора для 4 вариантов`)
    }
    const values = [slot.token, ...distractors.map((d) => d.text)]
    if (new Set(values.map(lower)).size !== values.length) {
      errors.push(`${slotAt}: правильный ответ и дистракторы должны быть уникальными`)
    }
    for (const [distractorIndex, distractor] of distractors.entries()) {
      if (!distractor?.text?.trim()) {
        errors.push(`${slotAt}.distractors[${distractorIndex}]: пустой текст`)
      }
      if (!Array.isArray(distractor.errorTags) || distractor.errorTags.length === 0) {
        errors.push(`${slotAt}.distractors[${distractorIndex}]: нет errorTags`)
      }
    }
  }
}

console.log(`Сочетаний: ${items.length}`)
for (const error of errors) console.error(`✗ ${error}`)
if (errors.length) process.exit(1)
console.log('✓ Пакет сочетаний валиден')
