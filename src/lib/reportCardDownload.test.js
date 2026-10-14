import test from 'node:test'
import assert from 'node:assert/strict'
import { saveBlob, validateDownloadBlob } from './reportCardDownload.js'

test('accepts only non-empty PDF and ZIP signatures', async () => {
  const pdf = new Blob([new Uint8Array([37, 80, 68, 70, 45, 49])], { type: 'application/pdf' })
  const zip = new Blob([new Uint8Array([80, 75, 3, 4])], { type: 'application/zip' })
  await validateDownloadBlob(pdf, 'pdf')
  await validateDownloadBlob(zip, 'zip')
  await assert.rejects(() => validateDownloadBlob(new Blob(['not a pdf'], { type: 'application/pdf' }), 'pdf'), /valid PDF/)
})

test('surfaces JSON API errors instead of downloading them', async () => {
  const response = new Blob([JSON.stringify({ message: 'Student record not found.' })], { type: 'application/json' })
  await assert.rejects(() => validateDownloadBlob(response, 'pdf'), /Student record not found/)
})

test('creates, clicks, and cleans up the browser download link', () => {
  const originalDocument = globalThis.document
  const originalUrl = globalThis.URL
  const originalWindow = globalThis.window
  const events = []
  const link = {
    style: {},
    click: () => events.push('click'),
    remove: () => events.push('remove'),
  }
  globalThis.document = {
    body: { appendChild: (element) => events.push(element === link ? 'append' : 'wrong-element') },
    createElement: () => link,
  }
  globalThis.URL = {
    createObjectURL: () => { events.push('create-url'); return 'blob:report-card' },
    revokeObjectURL: (url) => events.push(`revoke:${url}`),
  }
  globalThis.window = {
    setTimeout: (callback, delay) => { events.push(`schedule:${delay}`); callback() },
  }

  try {
    saveBlob(new Blob([new Uint8Array([37, 80, 68, 70, 45])], { type: 'application/pdf' }), 'Report_Card_4PM23CS001.pdf')
    assert.deepEqual(events, ['create-url', 'append', 'click', 'schedule:100', 'remove', 'schedule:1000', 'revoke:blob:report-card'])
    assert.equal(link.download, 'Report_Card_4PM23CS001.pdf')
  } finally {
    globalThis.document = originalDocument
    globalThis.URL = originalUrl
    globalThis.window = originalWindow
  }
})
