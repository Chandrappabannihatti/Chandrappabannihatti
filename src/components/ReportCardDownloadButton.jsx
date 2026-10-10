import { useState } from 'react'
import { FiAlertCircle, FiDownload } from 'react-icons/fi'
import api, { DEMO_MODE, getAuthToken, isApiToken } from '../lib/api'

function safeFilePart(value) {
  return String(value || 'student').replace(/[^A-Za-z0-9_-]+/g, '_')
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function errorMessage(error) {
  const responseData = error.response?.data
  if (responseData instanceof Blob) {
    try {
      const payload = JSON.parse(await responseData.text())
      return payload.message || 'The report card could not be generated.'
    } catch { /* fall through to the regular response message */ }
  }
  return error.response?.data?.message || error.message || 'The report card could not be generated.'
}

export default function ReportCardDownloadButton({
  studentId,
  usn,
  scope = {},
  bulkStudentIds = [],
  label = 'Download Report Card',
  className = 'button-ghost',
  onComplete,
  disabled = false,
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const bulk = Array.isArray(bulkStudentIds) && bulkStudentIds.length > 0

  const download = async () => {
    if (busy || disabled) return
    setError('')
    const token = getAuthToken()
    if (DEMO_MODE && !isApiToken(token)) {
      setError('PDF downloads require the API-enabled session so the report remains tied to the authorized record.')
      return
    }
    if (!bulk && !Number(studentId)) {
      setError('This student record does not have a valid identifier.')
      return
    }
    setBusy(true)
    try {
      const response = bulk
        ? await api.downloadReportCardsBulk(bulkStudentIds, scope)
        : await api.downloadReportCard(studentId, scope)
      const filename = bulk ? 'CAMPS_Report_Cards.zip' : `Report_Card_${safeFilePart(usn)}.pdf`
      saveBlob(response.data, filename)
      onComplete?.(bulk ? `${bulkStudentIds.length} report cards downloaded.` : 'Report card downloaded.')
    } catch (downloadError) {
      const message = await errorMessage(downloadError)
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return <span className="report-card-download-control">
    <button className={className} type="button" onClick={download} disabled={disabled || busy} aria-busy={busy}>
      <FiDownload /> {busy ? 'Preparing…' : label}
    </button>
    {error && <span className="report-card-download-error" role="alert"><FiAlertCircle /> {error}</span>}
  </span>
}
