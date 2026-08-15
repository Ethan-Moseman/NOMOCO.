// =============================================================================
// Request a mow — date, time window, and notes for THIS mow only.
// =============================================================================
// PERMANENT vs TEMPORARY NOTES
//   Permanent notes live on the property and are copied onto every job
//   automatically (gate latch, pets, do-not-mow strip).
//   Temporary notes apply to this one visit only (car in the driveway today).
// =============================================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '../../components/Layout';
import {
  Button,
  Card,
  DetailRow,
  ErrorBanner,
  Field,
  Loader,
  PageHeader,
  Select,
  TextArea,
  TextInput,
} from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { getPropertiesForOwner } from '../../services/properties';
import { requestMow } from '../../services/jobs';
import { TIME_OPTIONS } from '../../lib/constants';
import {
  friendlyError,
  fullAddress,
  money,
  prettyTime,
  todayISO,
} from '../../lib/format';

export default function RequestMow() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    requestedDate: '',
    timeStart: '14:00',
    timeEnd: '18:00',
    temporaryNotes: '',
  });

  useEffect(() => {
    let cancelled = false;
    getPropertiesForOwner(user.uid)
      .then((properties) => {
        if (!cancelled) setProperty(properties[0] || null);
      })
      .catch((caught) => {
        if (!cancelled) setError(friendlyError(caught));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user.uid]);

  function update(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const found = {};
    if (!form.requestedDate) found.requestedDate = 'Please choose a date.';
    if (form.timeEnd <= form.timeStart) {
      found.timeEnd = 'The latest time must be after the earliest time.';
    }
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      await requestMow({
        owner: { uid: user.uid, fullName: profile?.fullName || 'Customer' },
        property,
        request: {
          address: fullAddress(property),
          requestedDate: form.requestedDate,
          timeStart: form.timeStart,
          timeEnd: form.timeEnd,
          temporaryNotes: form.temporaryNotes,
        },
      });
      navigate('/dashboard?requested=mow', { replace: true });
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loader label="Loading your property…" />;

  // You cannot book a mow before we have seen the lawn and set a price.
  if (!property || !property.approved || property.customerPrice == null) {
    return (
      <Page>
        <PageHeader title="Request a Mow" back="/dashboard" />
        <Card>
          <h3>We need to see your lawn first</h3>
          <p className="muted small">
            Mowing opens up as soon as we have visited your property and set
            your flat price. The consultation is free.
          </p>
          <Button as="link" to="/request-consultation" size="lg" full>
            REQUEST A FREE LAWN CONSULTATION
          </Button>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Request a Mow"
        subtitle="Pick a day and the window that works for you."
        back="/dashboard"
      />

      <Card>
        <DetailRow label="Property" value={fullAddress(property)} />
        <DetailRow label="Your price" value={money(property.customerPrice)} strong />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <ErrorBanner>{error}</ErrorBanner>

        <form onSubmit={handleSubmit} noValidate>
          <Field label="Desired date" required error={errors.requestedDate}>
            <TextInput
              type="date"
              min={todayISO()}
              value={form.requestedDate}
              onChange={(e) => update('requestedDate', e.target.value)}
              error={errors.requestedDate}
            />
          </Field>

          <div className="row">
            <Field label="Earliest acceptable time" required>
              <Select
                value={form.timeStart}
                onChange={(e) => update('timeStart', e.target.value)}
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {prettyTime(time)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Latest acceptable time" required error={errors.timeEnd}>
              <Select
                value={form.timeEnd}
                onChange={(e) => update('timeEnd', e.target.value)}
                error={errors.timeEnd}
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {prettyTime(time)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="Notes for this mow only"
            hint="Just for this visit. Your permanent property notes are already included automatically."
          >
            <TextArea
              value={form.temporaryNotes}
              onChange={(e) => update('temporaryNotes', e.target.value)}
              placeholder="Kids' toys in the back yard today — please mow around them."
            />
          </Field>

          {property.permanentNotes ? (
            <div className="note-block">
              <span className="note-label">Always included with every mow</span>
              {property.permanentNotes}
            </div>
          ) : null}

          <Button type="submit" size="lg" full loading={saving}>
            {saving ? 'Sending your request…' : 'REQUEST A MOW'}
          </Button>
        </form>
      </Card>
    </Page>
  );
}
