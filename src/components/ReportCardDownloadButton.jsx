import { useState } from 'react'
import { FiAlertCircle, FiDownload } from 'react-icons/fi'
import api, { DEMO_MODE, getAuthToken, isApiToken } from '../lib/api'

function safeFilePart(value) {
  return String(value || 'student').replace(/[^A-Za-z0-9_-]+/g, '_')
}

function saveBlob(blob, filename) {
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
  reportData = null,
  reportStudents = [],
  label = 'Download Report Card',
  className = 'button-ghost',
  onComplete,
  disabled = false,
  allowLocalFallback = DEMO_MODE,
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const bulk = Array.isArray(bulkStudentIds) && bulkStudentIds.length > 0

  const download = async () => {
    if (busy || disabled) return
    setError('')
    setSuccess('')
    if (!bulk && !Number(studentId)) {
      setError('This student record does not have a valid identifier.')
      return
    }
    setBusy(true)
    try {
      const token = getAuthToken()
      if (isApiToken(token)) {
        const response = bulk
          ? await api.downloadReportCardsBulk(bulkStudentIds, scope)
          : await api.downloadReportCard(studentId, scope)
        const filename = bulk ? 'CAMPS_Report_Cards.zip' : `Report_Card_${safeFilePart(usn)}.pdf`
        saveBlob(response.data, filename)
      } else {
        if (!allowLocalFallback) throw new Error('Your secure API session is unavailable. Please sign in again before downloading the report card.')
        const localReports = bulk
          ? bulkStudentIds.map((selectedId) => {
            const student = reportStudents.find((item) => Number(item.id) === Number(selectedId))
            return student ? { student } : null
          })
          : [reportData || { student: { id: studentId, usn } }]
        if (localReports.some((report) => !report)) throw new Error('The selected student records are not available for a local report-card download.')
        const { createClientReportCardPdf, createClientReportCardsZip } = await import('../lib/clientReportCard')
        const blob = bulk ? await createClientReportCardsZip(localReports) : await createClientReportCardPdf(localReports[0])
        saveBlob(blob, bulk ? 'CAMPS_Report_Cards.zip' : `Report_Card_${safeFilePart(usn)}.pdf`)
      }
      const completionMessage = bulk ? 'Report card downloads started.' : 'Report card download started.'
      setSuccess(completionMessage)
      onComplete?.(bulk ? `${bulkStudentIds.length} report cards downloaded.` : 'Report card downloaded.')
    } catch (downloadError) {
      const message = await errorMessage(downloadError)
      setSuccess('')
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return <span className="report-card-download-control">
    <button className={className} type="button" onClick={download} disabled={disabled || busy} aria-busy={busy}>
      <FiDownload /> {busy ? 'Preparing…' : label}
    </button>
    {success && <span className="report-card-download-success" role="status">{success}</span>}
    {error && <span className="report-card-download-error" role="alert"><FiAlertCircle /> {error}</span>}
  </span>
}
