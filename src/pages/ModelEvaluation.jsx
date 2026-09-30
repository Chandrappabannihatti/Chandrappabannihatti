import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { FiAlertTriangle, FiBarChart2, FiCheckCircle, FiDatabase, FiInfo, FiShield, FiTarget, FiTrendingUp } from 'react-icons/fi'
import api from '../lib/api'
import { modelEvaluationFallback } from '../data/modelEvaluation'

const MATRIX_LABELS = ['Fail', 'Pass']
const PIE_COLORS = ['#d97867', '#2c9b87']

function metricDisplay(metrics, key) {
  const value = metrics?.[key]
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)}%` : 'N/A'
}

function metricTone(metrics, key) {
  const value = Number(metrics?.[key])
  if (!Number.isFinite(value)) return 'neutral'
  return value >= 90 ? 'positive' : value >= 75 ? 'watch' : 'risk'
}

function distributionRows(distribution) {
  return MATRIX_LABELS.map((label) => ({ name: label, value: Number(distribution?.[label] || 0) }))
}

function statusLabel(report) {
  if (report.status === 'evaluated' && report.modelLoaded) return 'Evaluated on unseen test data'
  return 'Dataset audit · model evaluation pending'
}

function CheckRow({ ok, label, detail }) {
  return <div className={`evaluation-check ${ok ? 'ok' : 'warning'}`}><span>{ok ? <FiCheckCircle /> : <FiAlertTriangle />}</span><div><strong>{label}</strong><p>{detail}</p></div></div>
}

export default function ModelEvaluation({ apiSession = false, semester, section, department }) {
  const [report, setReport] = useState(modelEvaluationFallback)
  const [loading, setLoading] = useState(Boolean(apiSession))
  const [sourceMessage, setSourceMessage] = useState('')

  useEffect(() => {
    if (!apiSession) {
      setReport(modelEvaluationFallback)
      setLoading(false)
      return undefined
    }
    let mounted = true
    setLoading(true)
    api.getModelEvaluation().then((result) => {
      if (!mounted) return
      setReport(result?.data || modelEvaluationFallback)
      setSourceMessage('')
    }).catch((error) => {
      if (!mounted) return
      setReport(modelEvaluationFallback)
      setSourceMessage(error.response?.data?.message || 'The evaluation report is not available yet. Showing the dataset audit.')
    }).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [apiSession])

  const metrics = report.metrics
  const actualDistribution = report.distributions?.actualTest || report.dataset?.classDistribution || {}
  const predictedDistribution = report.distributions?.predictedTest
  const distribution = predictedDistribution || actualDistribution
  const distributionData = useMemo(() => distributionRows(distribution), [distribution])
  const accuracyData = (report.accuracyComparison || []).map((item) => ({ name: item.name, accuracy: Number.isFinite(Number(item.accuracy)) ? Number(item.accuracy) : 0, unavailable: item.accuracy == null }))
  const confusion = report.confusionMatrix?.values
  const confusionLabels = report.confusionMatrix?.labels || MATRIX_LABELS
  const gap = report.trainMetrics && metrics && Number.isFinite(Number(report.trainMetrics.accuracy)) && Number.isFinite(Number(metrics.accuracy))
    ? Number(report.trainMetrics.accuracy) - Number(metrics.accuracy)
    : null
  const scope = [department, semester && `Semester ${semester}`, section && `Section ${section}`].filter(Boolean).join(' · ')

  return <div className="dashboard-content model-evaluation-page">
    <div className="page-intro model-evaluation-intro"><div><p className="page-eyebrow">Machine learning validation{scope ? ` · ${scope}` : ''}</p><h1 className="page-title">Model performance evaluation</h1><p className="page-subtitle">An 80:20 holdout audit for the five-input XGBoost student performance classifier.</p></div><span className={`model-evaluation-status ${report.status === 'evaluated' ? 'evaluated' : 'audit'}`}><i />{statusLabel(report)}</span></div>

    {(sourceMessage || report.status !== 'evaluated') && <div className="model-evaluation-alert"><FiAlertTriangle /><div><strong>{report.status === 'evaluated' ? 'Review the evaluation notes before presenting the score.' : 'A valid trained-model score is not available yet.'}</strong><p>{sourceMessage || report.summary}</p></div></div>}

    <section className="model-evaluation-kpis" aria-label="Model metrics">
      {[['accuracy', 'Accuracy', 'Overall correct classifications', FiTarget], ['precision', 'Precision', 'Correct positive predictions', FiCheckCircle], ['recall', 'Recall', 'Actual positives identified', FiTrendingUp], ['f1', 'F1 Score', 'Balance of precision and recall', FiBarChart2]].map(([key, label, description, Icon]) => <article className={`model-evaluation-kpi ${metricTone(metrics, key)}`} key={key}><div className="model-evaluation-kpi-icon"><Icon /></div><div><span>{label}</span><strong>{metricDisplay(metrics, key)}</strong><small>{description}</small></div></article>)}
    </section>

    <div className="model-evaluation-meta-grid">
      <div className="model-evaluation-meta"><FiDatabase /><div><span>Dataset</span><strong>{report.dataset?.rowsAfterCleaning || report.dataset?.rowsBeforeCleaning || '—'} records</strong><small>{report.dataset?.targetColumn ? `Observed target: ${report.dataset.targetColumn}` : 'No observed target column'}</small></div></div>
      <div className="model-evaluation-meta"><FiShield /><div><span>Split</span><strong>{Math.round((report.split?.trainRatio || 0.8) * 100)}:{Math.round((report.split?.testSize || 0.2) * 100)} train/test</strong><small>{report.split?.trainRows || '—'} train · {report.split?.testRows || '—'} unseen test</small></div></div>
      <div className="model-evaluation-meta"><FiBarChart2 /><div><span>Model</span><strong>{report.modelName || 'XGBoost classifier'}</strong><small>{report.modelLoaded ? report.modelPath : 'Artifact not loaded'}</small></div></div>
      <div className="model-evaluation-meta"><FiInfo /><div><span>Target source</span><strong>{report.dataset?.targetIsProxy ? 'Proxy / audit only' : 'Observed outcomes'}</strong><small>Random state {report.split?.randomState ?? 42}</small></div></div>
    </div>

    <div className="model-evaluation-chart-grid">
      <section className="content-card model-evaluation-card"><div className="card-heading"><div><h2 className="card-title">Accuracy comparison</h2><p className="card-description">XGBoost versus the majority-class baseline</p></div><FiBarChart2 /></div>{accuracyData.length ? <div className="model-evaluation-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={accuracyData} margin={{ top: 8, right: 14, left: -20, bottom: 4 }}><CartesianGrid vertical={false} strokeDasharray="3 4" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} /><Tooltip formatter={(value, _name, item) => item.payload.unavailable ? ['N/A', 'Accuracy'] : [`${value}%`, 'Accuracy']} /><Bar dataKey="accuracy" radius={[7, 7, 0, 0]}>{accuracyData.map((item) => <Cell key={item.name} fill={item.unavailable ? '#cbd5d2' : '#2c9186'} />)}</Bar></BarChart></ResponsiveContainer></div> : <div className="model-evaluation-empty">No comparison data available.</div>}</section>

      <section className="content-card model-evaluation-card"><div className="card-heading"><div><h2 className="card-title">Pass vs Fail distribution</h2><p className="card-description">{predictedDistribution ? 'Predicted classes on the unseen test set' : 'Available target distribution · predictions not available'}</p></div><FiTrendingUp /></div><div className="model-evaluation-pie-row"><div className="model-evaluation-pie"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={distributionData} dataKey="value" nameKey="name" innerRadius={53} outerRadius={76} paddingAngle={3}>{distributionData.map((item, index) => <Cell key={item.name} fill={PIE_COLORS[index]} />)}</Pie><Tooltip formatter={(value, name) => [value, name]} /></PieChart></ResponsiveContainer></div><div className="model-evaluation-legend">{distributionData.map((item, index) => <div key={item.name}><i style={{ background: PIE_COLORS[index] }} /><span>{item.name}</span><strong>{item.value}</strong></div>)}<small>{predictedDistribution ? 'Test predictions' : 'Dataset audit only'}</small></div></div></section>
    </div>

    <div className="model-evaluation-lower-grid">
      <section className="content-card model-evaluation-card"><div className="card-heading"><div><h2 className="card-title">Confusion matrix</h2><p className="card-description">Rows are actual values; columns are predicted values</p></div><FiTarget /></div>{confusion ? <table className="model-evaluation-matrix"><caption>Confusion matrix for unseen test records</caption><thead><tr><th>Actual \ Predicted</th>{confusionLabels.map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{confusion.map((row, rowIndex) => <tr key={confusionLabels[rowIndex]}><th>{confusionLabels[rowIndex]}</th>{row.map((value, columnIndex) => <td className={rowIndex === columnIndex ? 'correct' : 'incorrect'} key={`${rowIndex}-${columnIndex}`}>{value}</td>)}</tr>)}</tbody></table> : <div className="model-evaluation-matrix-empty"><FiAlertTriangle /><strong>Confusion matrix unavailable</strong><p>An observed two-class target and a loaded model are required before this table can be calculated.</p></div>}</section>

      <section className="content-card model-evaluation-card"><div className="card-heading"><div><h2 className="card-title">Fit and leakage checks</h2><p className="card-description">Diagnostics for overfitting, imbalance, and split quality</p></div><FiShield /></div><div className="model-evaluation-checks"><CheckRow ok={!report.checks?.duplicateRows} label="Duplicate records" detail={report.checks?.duplicateRows ? `${report.checks.duplicateRows} duplicate feature/target rows detected.` : 'No duplicate feature/target rows detected.'} /><CheckRow ok={report.checks?.trainTestOverlap === 0} label="Train/test overlap" detail={report.checks?.trainTestOverlap == null ? 'Not assessed until a model evaluation is generated.' : report.checks.trainTestOverlap ? `${report.checks.trainTestOverlap} exact feature rows overlap.` : 'No exact feature rows overlap.'} /><CheckRow ok={!report.checks?.targetLeakageConcern} label="Target leakage" detail={report.checks?.targetLeakageConcern ? 'Target is missing or derived from the same academic formula used by the fallback.' : 'No target leakage flag was raised by the audit.'} /><CheckRow ok={!report.checks?.classImbalance} label="Class balance" detail={report.checks?.classImbalance ? 'Class distribution is unsuitable for a reliable binary evaluation.' : 'Both classes have a usable representation.'} /></div>{gap != null && <div className={`model-evaluation-gap ${gap > 10 ? 'warning' : ''}`}><strong>Generalisation gap: {gap.toFixed(2)} percentage points</strong><span>{gap > 10 ? 'Possible overfitting signal' : 'No strong overfitting signal from accuracy alone'}</span></div>}<div className="model-evaluation-fit-assessment"><strong>Fit assessment</strong><p>{report.fitAssessment || 'Overfitting and underfitting require comparable train and unseen-test metrics.'}</p></div></section>
    </div>

    <div className="model-evaluation-report-grid"><section className="content-card model-evaluation-card"><div className="card-heading"><div><h2 className="card-title">Metric interpretation</h2><p className="card-description">How to explain the results during documentation or viva</p></div></div><div className="model-evaluation-explanations"><div><strong>Accuracy</strong><p>Percentage of all test records classified correctly. It can be misleading when Pass and Fail classes are imbalanced.</p></div><div><strong>Precision</strong><p>Of the students predicted as the positive class, the percentage that truly belongs to that class.</p></div><div><strong>Recall</strong><p>Of the students who truly belong to the positive class, the percentage identified by the model.</p></div><div><strong>F1 Score</strong><p>Harmonic mean of precision and recall. It is useful when both missed cases and false alarms matter.</p></div></div></section><section className="content-card model-evaluation-card"><div className="card-heading"><div><h2 className="card-title">Recommendations</h2><p className="card-description">Actions before using the model in production</p></div><FiInfo /></div><ul className="model-evaluation-recommendations">{(report.recommendations || []).map((item) => <li key={item}>{item}</li>)}</ul></section></div>

    <section className="model-evaluation-summary"><div><p className="page-eyebrow">Final performance summary</p><h2>{report.status === 'evaluated' ? 'Holdout evaluation completed' : 'Evaluation readiness audit'}</h2><p>{report.summary}</p></div><div className="model-evaluation-summary-note"><FiInfo /><span>Never present 100% accuracy as proof of generalisation until the target is observed, both classes are represented, duplicates are removed, and the test set remains untouched.</span></div></section>
    {loading && <div className="model-evaluation-loading">Refreshing the evaluation report…</div>}
  </div>
}
