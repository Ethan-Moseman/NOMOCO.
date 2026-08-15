// =============================================================================
// Home — what somebody sees three seconds after scanning a door hanger.
// =============================================================================
// Rules for this page: one obvious thing to do, and no clutter. The biggest
// button is the free consultation. Everything else is smaller on purpose.
// =============================================================================

import { useNavigate } from 'react-router-dom';
import { Page } from '../components/Layout';
import { Button } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { BRAND, ROLES } from '../lib/constants';

export default function Home() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  /**
   * Both main buttons work whether or not you have an account. If you are
   * signed out we send you to sign-up first and then straight on to the form
   * you wanted — you never lose your place.
   */
  function go(destination) {
    if (loading) return;
    if (!user) {
      navigate('/signup', { state: { from: destination } });
    } else {
      navigate(destination);
    }
  }

  const dashboardPath =
    role === ROLES.ADMIN ? '/admin' : role === ROLES.EMPLOYEE ? '/employee' : '/dashboard';

  return (
    <Page>
      <section className="hero">
        {/*
          The banner shows a photo if you put one at public/hero.jpg, and a
          clean green gradient if you have not yet. It is a CSS background
          rather than an <img>, so a missing file degrades quietly instead of
          showing a broken-image icon.
        */}
        <div className="hero-photo" aria-hidden="true">
          <svg className="hero-mark" viewBox="0 0 64 64" aria-hidden="true">
            <g fill="currentColor">
              <path d="M16 49 Q13 32 26 19 Q19 35 23 49 Z" />
              <path d="M29 49 Q29 27 32 12 Q37 29 36 49 Z" />
              <path d="M41 49 Q47 33 51 21 Q46 37 48 49 Z" />
            </g>
            <rect x="11" y="48" width="42" height="6" rx="3" fill="currentColor" />
          </svg>
        </div>

        <h1 className="hero-logo">{BRAND.name}</h1>
        <p className="hero-tagline">{BRAND.tagline}</p>
        <p className="hero-sub">
          Local lawn mowing you can book from your phone. Start with a free
          look at your lawn — no cost, no commitment.
        </p>

        <div className="trust-row">
          <span className="trust-pill">Student Owned</span>
          <span className="trust-pill">Local</span>
          <span className="trust-pill">Affordable</span>
          <span className="trust-pill">Reliable</span>
        </div>

        {/*
          One line only. The home page has to stay uncluttered — the full
          story lives on How It Works for people who want it.
        */}
        <p className="hero-founded">
          Founded in 2025 by high school students · Built through DECA
        </p>
      </section>

      <div className="home-actions">
        {/* The single most important button on the whole website. */}
        <Button size="lg" full onClick={() => go('/request-consultation')}>
          REQUEST A FREE LAWN CONSULTATION
        </Button>

        <Button
          size="lg"
          full
          variant="secondary"
          onClick={() => go('/request-mow')}
        >
          REQUEST A MOW
        </Button>
      </div>

      <p className="center small muted" style={{ marginTop: 14 }}>
        New here? Start with the free consultation — we look at your lawn and
        set your price, then mowing is one tap away.
      </p>

      <div className="home-secondary">
        {user ? (
          <Button as="link" to={dashboardPath} variant="ghost">
            My Account
          </Button>
        ) : (
          <Button as="link" to="/signin" variant="ghost">
            Sign In
          </Button>
        )}
        <Button as="link" to="/how-it-works" variant="ghost">
          How It Works
        </Button>
        <Button as="link" to="/contact" variant="ghost">
          Contact
        </Button>
        <Button
          as="link"
          to={user ? dashboardPath : '/signup'}
          variant="ghost"
        >
          {user ? 'My Lawn' : 'Create Account'}
        </Button>
      </div>
    </Page>
  );
}
