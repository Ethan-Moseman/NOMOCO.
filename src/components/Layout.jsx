// =============================================================================
// Layout — the top bar, the "View As" banner, and the page shell.
// =============================================================================

import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BRAND, ROLES } from '../lib/constants';
import { Button } from './UI';

export function NavBar() {
  const { user, role, effectiveRole, logOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  async function handleSignOut() {
    setMenuOpen(false);
    await logOut();
    navigate('/');
  }

  /** Where "My Account" / the logo should send this person. */
  const homeFor = {
    [ROLES.ADMIN]: '/admin',
    [ROLES.EMPLOYEE]: '/employee',
    [ROLES.CUSTOMER]: '/dashboard',
  }[effectiveRole];

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
          {BRAND.name}
        </Link>

        <button
          className="menu-toggle"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className={`nav-links ${menuOpen ? 'nav-links-open' : ''}`}>
          <Link to="/how-it-works" onClick={() => setMenuOpen(false)}>
            How It Works
          </Link>
          <Link to="/contact" onClick={() => setMenuOpen(false)}>
            Contact
          </Link>

          {user ? (
            <>
              <Link to={homeFor} onClick={() => setMenuOpen(false)}>
                My Account
              </Link>
              {role === ROLES.ADMIN ? (
                <Link to="/admin" onClick={() => setMenuOpen(false)}>
                  Admin
                </Link>
              ) : null}
              <button className="nav-signout" onClick={handleSignOut}>
                Sign Out
              </button>
            </>
          ) : (
            <Link to="/signin" onClick={() => setMenuOpen(false)}>
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

/**
 * Shown only when an admin is previewing another role.
 *
 * IMPORTANT: this is a VIEW toggle, not a login. The admin stays signed in as
 * themselves and their own permissions still apply — we are not weakening
 * authentication or impersonating anybody's account. It exists so you can see
 * the layout a customer or mower sees.
 */
export function ViewAsBanner() {
  const { role, previewRole, setPreviewRole } = useAuth();
  if (role !== ROLES.ADMIN || !previewRole) return null;

  return (
    <div className="viewas-banner">
      <span>
        Previewing as <strong>{previewRole}</strong> — you are still signed in
        as admin.
      </span>
      <button onClick={() => setPreviewRole(null)}>Exit preview</button>
    </div>
  );
}

export function Page({ children, width = 'normal' }) {
  return (
    <>
      <NavBar />
      <ViewAsBanner />
      <main className={`page page-${width}`}>{children}</main>
      <Footer />
    </>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <p className="footer-brand">{BRAND.name}</p>
      <p className="footer-tagline">{BRAND.tagline}</p>
      <p className="footer-links">
        <a href={`tel:${BRAND.phone.replace(/\D/g, '')}`}>{BRAND.phone}</a>
        <span aria-hidden="true"> · </span>
        <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
      </p>
    </footer>
  );
}

/** A dashboard heading with an optional action button on the right. */
export function SectionHeading({ children, action }) {
  return (
    <div className="section-heading">
      <h2>{children}</h2>
      {action}
    </div>
  );
}

export { Button };
