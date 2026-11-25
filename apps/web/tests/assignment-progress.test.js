import { assignmentProgress, assignmentReviewRows } from '../lib/engine/assignment-progress'
const ex = id => ({ kind:'exercise', ex:{ id } })
const stage = { id:'grammar', steps:[ex('a'),ex('b')] }
const result = (exerciseId, correct, time=1, dayNumber=5) => ({ exerciseId, correct, completedAt:new Date(time), dayNumber })
it('counts distinct assigned questions, not unrelated reviews or word cards', () => {
  expect(assignmentProgress([stage,{ id:'words', steps:[ex('w')] }],[result('a',true),result('w',true),result('review:b',true)],5)).toEqual({total:2,answered:1,correct:1})
})
it('reviews only completed curriculum days and resolves mistakes without mutating lesson answers', () => {
  const original = result('a',false)
  const summaries = [{dayNumber:5,exerciseIds:['a','b','ex.reading.sample.q']},{dayNumber:6,exerciseIds:['c']}]
  expect(assignmentReviewRows(summaries,[original],new Set([5]))).toEqual([{dayNumber:5,ids:['a','b'],missing:['b'],mistakes:['a']}])
  expect(assignmentReviewRows(summaries,[result('review:a',true,2),original,result('review:b',true,3)],new Set([5]))[0]).toEqual({dayNumber:5,ids:['a','b'],missing:[],mistakes:[]})
  expect(original.correct).toBe(false)
})


it('includes historical mistakes and correct answers after several attempts', () => {
  const history = {...result('ex.sgap.pl.gram.test.0.typed', true), attempts: 3}
  expect(assignmentReviewRows([], [history], new Set())[0].mistakes).toEqual([history.exerciseId])
  const fixed = {...result('review:' + history.exerciseId, true, 2), attempts:1}
  expect(assignmentReviewRows([], [history,fixed], new Set())).toEqual([])
})
it('recovers archived mistakes, excludes word errors, and does not invent missing exercises', () => {
  const archived = {...result('ex.swrite.pl.gram.test.1', false), attempts:3, completedAt:new Date(1).toISOString()}
  const word = {...result('ex.rec.word',false), attempts:1}
  const rows = assignmentReviewRows([], [word], new Set([5]), [archived])
  expect(rows).toHaveLength(1)
  expect(rows[0].missing).toEqual([])
  expect(rows[0].mistakes).toEqual([archived.exerciseId])
})
