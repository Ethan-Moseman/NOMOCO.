// =============================================================================
// SignIn — one form for customers, employees and admins.
// =============================================================================
// Everyone signs in the same way. What you can see afterwards is decided by
// your role, which the database works out — never by anything typed here.
// =============================================================================

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Page } from '../components/Layout';
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  PageHeader,
  SuccessBanner,
  TextInput,
} from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { friendlyError, isValidEmail } from '../lib/format';
import { ROLES } from '../lib/constants';

export default function SignIn() {
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!isValidEmail(email)) return setError('Please enter a valid email address.');
    if (!password) return setError('Please enter your password.');

    setSaving(true);
    try {
      // signIn resolves the role from the database and hands it back, so we
      // can send people straight to the dashboard that belongs to them.
      const signedInRole = await signIn(email, password);
      const target = location.state?.from || homePathForRole(signedInRole);
      navigate(target, { replace: true });
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setError('');
    setNotice('');
    if (!isValidEmail(email)) {
      return setError('Enter your email address above first, then tap this again.');
    }
    try {
      await resetPassword(email);
      setNotice('Password reset email sent. Check your inbox.');
    } catch (caught) {
      setError(friendlyError(caught));
    }
  }

  return (
    <Page>
      <PageHeader title="Sign In" subtitle="Welcome back." back="/" />

      <Card>
        <ErrorBanner>{error}</ErrorBanner>
        <SuccessBanner>{notice}</SuccessBanner>

        <form onSubmit={handleSubmit} noValidate>
          <Field label="Email" required>
            <TextInput
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </Field>

          <Field label="Password" required>
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>

          <Button type="submit" size="lg" full loading={saving}>
            {saving ? 'Signing in…' : 'SIGN IN'}
          </Button>
        </form>

        <Button variant="ghost" full size="sm" onClick={handleReset} style={{ marginTop: 12 }}>
          Forgot your password?
        </Button>
      </Card>

      <p className="center small" style={{ marginTop: 16 }}>
        New to NO MO CO.? <Link to="/signup">Create an account</Link>
      </p>
    </Page>
  );
}

/** Handy elsewhere: which dashboard belongs to which role. */
export function homePathForRole(role) {
  if (role === ROLES.ADMIN) return '/admin';
  if (role === ROLES.EMPLOYEE) return '/employee';
  return '/dashboard';
}
