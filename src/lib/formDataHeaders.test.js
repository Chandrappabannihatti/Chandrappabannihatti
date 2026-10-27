import test from 'node:test'
import assert from 'node:assert/strict'
import { removeJsonContentType } from './formDataHeaders.js'

test('removes the JSON content type for FormData without dropping authorization', () => {
  const form = new FormData()
  form.append('file', new Blob(['USN,Name\n4PM26TEST001,Test Student'], { type: 'text/csv' }), 'students.csv')
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer import-token',
    'X-Access-Token': 'import-token',
  }

  const prepared = removeJsonContentType(headers, form)

  assert.equal(prepared['Content-Type'], undefined)
  assert.equal(prepared.Authorization, 'Bearer import-token')
  assert.equal(prepared['X-Access-Token'], 'import-token')
})

test('leaves JSON requests unchanged', () => {
  const headers = { 'Content-Type': 'application/json' }
  const prepared = removeJsonContentType(headers, JSON.stringify({ commit: true }))

  assert.equal(prepared['Content-Type'], 'application/json')
})
