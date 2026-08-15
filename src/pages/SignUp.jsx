// =============================================================================
// SignUp — creates a CUSTOMER account. That is the only kind signup can make.
// =============================================================================
// There is deliberately no "I am an employee" option. Employees sign up here
// like anyone else and an admin approves them afterwards, and admin can only
// be granted by hand in the Firebase Console. See firestore.rules.
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
  TextInput,
} from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { formatPhoneInput, friendlyError, isValidEmail, isValidPhone } from '../lib/format';

export default function SignUp() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Where to go once the account exists — set by the home page buttons.
  const next = location.state?.from || '/request-consultation';

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  function update(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  }

  function validate() {
    const found = {};
    if (!form.fullName.trim()) found.fullName = 'Please enter your full name.';
    if (!isValidEmail(form.email)) found.email = 'Please enter a valid email address.';
    if (!isValidPhone(form.phone)) found.phone = 'Please enter a 10-digit phone number.';
    if (form.password.length < 6) found.password = 'Use at least 6 characters.';
    if (form.password !== form.confirm) found.confirm = 'The passwords do not match.';
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError('');
    if (!validate()) return;

    setSaving(true);
    try {
      await signUp(form);
      navigate(next, { replace: true });
    } catch (error) {
      setSubmitError(friendlyError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <PageHeader
        title="Create Your Account"
        subtitle="Takes about 30 seconds. We only ask for what we need to mow your lawn."
        back="/"
      />

      <Card>
        <ErrorBanner>{submitError}</ErrorBanner>

        <form onSubmit={handleSubmit} noValidate>
          <Field label="Full name" required error={errors.fullName}>
            <TextInput
              value={form.fullName}
              onChange={(e) => update('fullName', e.target.value)}
              autoComplete="name"
              placeholder="Bob Johnson"
              error={errors.fullName}
            />
          </Field>

          <Field label="Email" required error={errors.email}>
            <TextInput
              type="email"
              inputMode="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              autoComplete="email"
              placeholder="bob@example.com"
              error={errors.email}
            />
          </Field>

          <Field label="Phone number" required error={errors.phone}>
            <TextInput
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => update('phone', formatPhoneInput(e.target.value))}
              autoComplete="tel"
              placeholder="(920) 555-0134"
              error={errors.phone}
            />
          </Field>

          <Field
            label="Password"
            required
            error={errors.password}
            hint="At least 6 characters."
          >
            <TextInput
              type="password"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              autoComplete="new-password"
              error={errors.password}
            />
          </Field>

          <Field label="Confirm password" required error={errors.confirm}>
            <TextInput
              type="password"
              value={form.confirm}
              onChange={(e) => update('confirm', e.target.value)}
              autoComplete="new-password"
              error={errors.confirm}
            />
          </Field>

          <Button type="submit" size="lg" full loading={saving}>
            {saving ? 'Creating your account…' : 'CREATE ACCOUNT'}
          </Button>
        </form>
      </Card>

      <p className="center small" style={{ marginTop: 16 }}>
        Already have an account? <Link to="/signin">Sign in</Link>
      </p>
    </Page>
  );
}
