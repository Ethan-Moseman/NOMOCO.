// =============================================================================
// UI.jsx — the small reusable pieces every page is built from.
// =============================================================================
// Kept in one file on purpose: these are all tiny, and one import line beats
// eight. If any of them grows past ~40 lines, move it to its own file.
// =============================================================================

import { Link } from 'react-router-dom';
import { JOB_STATUS_LABELS, CONSULTATION_STATUS_LABELS, STATUS_TONES } from '../lib/constants';

/* ------------------------------------------------------------------ Button */
/**
 * variant: primary | secondary | ghost | danger   size: lg | md | sm
 *
 * Three shapes, so a button always renders the right HTML element:
 *   <Button onClick={…}>            -> a real <button>
 *   <Button as="link" to="/page">   -> react-router <Link>, for pages we own
 *   <Button href="tel:…">           -> a plain <a>, for tel:, mailto:, maps
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  full = false,
  loading = false,
  as,
  to,
  href,
  ...rest
}) {
  const className = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    full ? 'btn-full' : '',
    rest.className || '',
  ]
    .filter(Boolean)
    .join(' ');

  if (href) {
    return (
      <a {...rest} href={href} className={className}>
        {children}
      </a>
    );
  }

  if (as === 'link' && to) {
    return (
      <Link {...rest} to={to} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button {...rest} className={className} disabled={rest.disabled || loading}>
      {loading ? <span className="spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------- Card */
export function Card({ children, className = '', ...rest }) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ children, action }) {
  return (
    <div className="card-title">
      <h3>{children}</h3>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------- StatusBadge */
export function StatusBadge({ status, kind = 'job' }) {
  if (!status) return null;
  const labels = kind === 'job' ? JOB_STATUS_LABELS : CONSULTATION_STATUS_LABELS;
  const tone = STATUS_TONES[status] || 'muted';
  return <span className={`badge badge-${tone}`}>{labels[status] || status}</span>;
}

/* -------------------------------------------------------------- Form field */
export function Field({ label, error, hint, children, required }) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {required ? <span className="required"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}

export function TextInput({ error, ...rest }) {
  return <input className={`input ${error ? 'input-error' : ''}`} {...rest} />;
}

export function TextArea({ error, ...rest }) {
  return <textarea className={`input textarea ${error ? 'input-error' : ''}`} {...rest} />;
}

export function Select({ error, children, ...rest }) {
  return (
    <select className={`input ${error ? 'input-error' : ''}`} {...rest}>
      {children}
    </select>
  );
}

/* ----------------------------------------------------------- State helpers */
export function Loader({ label = 'Loading…' }) {
  return (
    <div className="loader" role="status">
      <span className="spinner spinner-lg" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({ title, message, action }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {message ? <p className="empty-message">{message}</p> : null}
      {action}
    </div>
  );
}

export function ErrorBanner({ children }) {
  if (!children) return null;
  return (
    <div className="banner banner-error" role="alert">
      {children}
    </div>
  );
}

export function SuccessBanner({ children }) {
  if (!children) return null;
  return (
    <div className="banner banner-success" role="status">
      {children}
    </div>
  );
}

export function InfoBanner({ children }) {
  if (!children) return null;
  return <div className="banner banner-info">{children}</div>;
}

/* --------------------------------------------------------------- Page bits */
export function PageHeader({ title, subtitle, back }) {
  return (
    <header className="page-header">
      {back ? (
        <Link to={back} className="back-link">
          ← Back
        </Link>
      ) : null}
      <h1>{title}</h1>
      {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
    </header>
  );
}

/** A label + value row, the workhorse of every detail screen. */
export function DetailRow({ label, value, strong = false }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className={`detail-value ${strong ? 'strong' : ''}`}>{value ?? '—'}</span>
    </div>
  );
}

/** Simple tab strip used by the admin dashboard. */
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          className={`tab ${active === tab.id ? 'tab-active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.count ? <span className="tab-count">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Thumbnail strip for property / completion photos. */
export function PhotoStrip({ photos = [] }) {
  if (!photos.length) return null;
  return (
    <div className="photo-strip">
      {photos.map((url) => (
        <a key={url} href={url} target="_blank" rel="noreferrer">
          <img src={url} alt="Property" loading="lazy" />
        </a>
      ))}
    </div>
  );
}
