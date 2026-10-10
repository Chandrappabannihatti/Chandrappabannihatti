function hasBytes(bytes, expected) {
  const signature = expected === 'pdf' ? [37, 80, 68, 70, 45] : [80, 75]
  return signature.every((byte, index) => bytes[index] === byte)
}

export function saveBlob(blob, filename) {
  if (!blob || Number(blob.size) === 0) throw new Error('The generated report is empty.')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  window.setTimeout(() => link.remove(), 100)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function validateDownloadBlob(blob, expected) {
  if (!blob || Number(blob.size) === 0) throw new Error('The generated report is empty.')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const contentType = String(blob.type || '').toLowerCase()
  const validType = expected === 'pdf' ? contentType.includes('application/pdf') : contentType.includes('application/zip')
  if (validType && hasBytes(bytes, expected)) return
  if (contentType.includes('json')) {
    try {
      const payload = JSON.parse(await blob.text())
      throw new Error(payload.message || 'The server returned an error instead of a report.')
    } catch (error) {
      if (error instanceof Error && error.message) throw error
      throw new Error('The server returned an error instead of a report.')
    }
  }
  throw new Error(expected === 'pdf' ? 'The server did not return a valid PDF report.' : 'The server did not return a valid report-card archive.')
}
