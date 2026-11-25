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
