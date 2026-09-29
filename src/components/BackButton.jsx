import { useNavigate } from 'react-router-dom'
import { FiArrowLeft } from 'react-icons/fi'

/**
 * Return to the previous in-app route when one exists. BrowserRouter stores
 * its history index in history.state; an initial/direct load has no in-app
 * page to return to, so it uses the role-aware fallback instead.
 */
export default function BackButton({ fallbackPath = '/app', label = 'Back', className = '', minHistoryIndex = 2 }) {
  const navigate = useNavigate()

  const goBack = () => {
    const historyIndex = window.history.state?.idx
    if (Number.isInteger(historyIndex) && historyIndex >= minHistoryIndex) navigate(-1)
    else navigate(fallbackPath, { replace: true })
  }

  return <button className={`back-button${className ? ` ${className}` : ''}`} type="button" onClick={goBack} aria-label={label}>
    <FiArrowLeft aria-hidden="true" />
    <span>{label}</span>
  </button>
}
