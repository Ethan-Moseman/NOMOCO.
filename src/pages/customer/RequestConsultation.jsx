// =============================================================================
// Request a free consultation — the form the QR code is really pointing at.
// =============================================================================
// Submitting this does two things at once:
//   1. Creates the customer's PROPERTY (address + permanent notes + photos)
//   2. Creates the CONSULTATION request that lands on the admin dashboard
//
// The property is created unapproved and with no price. Only an admin can
// change either of those — that rule lives in firestore.rules, not here.
// =============================================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '../../components/Layout';
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  InfoBanner,
  Loader,
  PageHeader,
  Select,
  TextArea,
  TextInput,
} from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { createProperty, getPropertiesForOwner, updatePropertyDetails } from '../../services/properties';
import { createConsultation } from '../../services/consultations';
import { uploadPhotos } from '../../services/photos';
import { TIME_OPTIONS } from '../../lib/constants';
import {
  formatPhoneInput,
  friendlyError,
  fullAddress,
  isValidEmail,
  isValidPhone,
  prettyTime,
  todayISO,
} from '../../lib/format';

export default function RequestConsultation() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [existingProperty, setExistingProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [errors, setErrors] = useState({});
  const [files, setFiles] = useState([]);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    addressLine1: '',
    city: '',
    state: 'WI',
    zip: '',
    preferredDate: '',
    preferredTimeStart: '09:00',
    preferredTimeEnd: '17:00',
    permanentNotes: '',
    notes: '',
  });

  // Pre-fill everything we already know so the customer types as little as
  // possible on a phone.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const properties = await getPropertiesForOwner(user.uid);
        const property = properties[0] || null;
        if (cancelled) return;

        setExistingProperty(property);
        setForm((previous) => ({
          ...previous,
          fullName: profile?.fullName || '',
          email: profile?.email || user.email || '',
          phone: profile?.phone || '',
          addressLine1: property?.addressLine1 || '',
          city: property?.city || '',
          state: property?.state || 'WI',
          zip: property?.zip || '',
          permanentNotes: property?.permanentNotes || '',
        }));
      } catch (error) {
        if (!cancelled) setSubmitError(friendlyError(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user, profile]);

  function update(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  }

  function validate() {
    const found = {};
    if (!form.fullName.trim()) found.fullName = 'Please enter your name.';
    if (!isValidEmail(form.email)) found.email = 'Please enter a valid email.';
    if (!isValidPhone(form.phone)) found.phone = 'Please enter a 10-digit phone number.';
    if (!form.addressLine1.trim()) found.addressLine1 = 'Please enter your street address.';
    if (!form.city.trim()) found.city = 'Please enter your city.';
    if (!/^\d{5}$/.test(form.zip.trim())) found.zip = 'Please enter a 5-digit ZIP code.';
    if (!form.preferredDate) found.preferredDate = 'Please choose a preferred date.';
    if (form.preferredTimeEnd <= form.preferredTimeStart) {
      found.preferredTimeEnd = 'The latest time must be after the earliest time.';
    }
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError('');
    if (!validate()) return;

    setSaving(true);
    try {
      // Photos are optional — if an upload fails we carry on rather than
      // losing the whole request.
      let photoUrls = [];
      if (files.length) {
        photoUrls = await uploadPhotos(user.uid, files, 'propertyPhotos').catch(() => []);
      }

      // 1. The property.
      let property = existingProperty;
      if (property) {
        await updatePropertyDetails(property.id, {
          ...form,
          photos: [...(property.photos || []), ...photoUrls],
        });
        property = { ...property, ...form };
      } else {
        property = await createProperty(user.uid, { ...form, photos: photoUrls });
      }

      // 2. The consultation request.
      await createConsultation(user.uid, {
        propertyId: property.id,
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        address: fullAddress(form),
        preferredDate: form.preferredDate,
        preferredTimeStart: form.preferredTimeStart,
        preferredTimeEnd: form.preferredTimeEnd,
        notes: form.notes,
        photos: photoUrls,
      });

      navigate('/dashboard?requested=consultation', { replace: true });
    } catch (error) {
      setSubmitError(friendlyError(error));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loader label="Getting your details…" />;

  return (
    <Page>
      <PageHeader
        title="Request a Free Consultation"
        subtitle="We stop by, look at your lawn, and set one honest price. No cost, no commitment."
        back="/dashboard"
      />

      <Card>
        <ErrorBanner>{submitError}</ErrorBanner>

        <form onSubmit={handleSubmit} noValidate>
          <h3>Your details</h3>

          <Field label="Full name" required error={errors.fullName}>
            <TextInput
              value={form.fullName}
              onChange={(e) => update('fullName', e.target.value)}
              autoComplete="name"
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
              error={errors.phone}
            />
          </Field>

          <h3 style={{ marginTop: 22 }}>Property address</h3>

          <Field label="Street address" required error={errors.addressLine1}>
            <TextInput
              value={form.addressLine1}
              onChange={(e) => update('addressLine1', e.target.value)}
              autoComplete="address-line1"
              placeholder="123 Main St"
              error={errors.addressLine1}
            />
          </Field>

          <div className="row">
            <Field label="City" required error={errors.city}>
              <TextInput
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
                autoComplete="address-level2"
                error={errors.city}
              />
            </Field>
            <Field label="State" required>
              <TextInput
                value={form.state}
                onChange={(e) => update('state', e.target.value)}
                autoComplete="address-level1"
                maxLength={2}
              />
            </Field>
            <Field label="ZIP" required error={errors.zip}>
              <TextInput
                inputMode="numeric"
                value={form.zip}
                onChange={(e) => update('zip', e.target.value.replace(/\D/g, '').slice(0, 5))}
                autoComplete="postal-code"
                error={errors.zip}
              />
            </Field>
          </div>

          <h3 style={{ marginTop: 22 }}>When works for you?</h3>

          <Field label="Preferred date" required error={errors.preferredDate}>
            <TextInput
              type="date"
              min={todayISO()}
              value={form.preferredDate}
              onChange={(e) => update('preferredDate', e.target.value)}
              error={errors.preferredDate}
            />
          </Field>

          <div className="row">
            <Field label="Earliest time" required>
              <Select
                value={form.preferredTimeStart}
                onChange={(e) => update('preferredTimeStart', e.target.value)}
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {prettyTime(time)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Latest time" required error={errors.preferredTimeEnd}>
              <Select
                value={form.preferredTimeEnd}
                onChange={(e) => update('preferredTimeEnd', e.target.value)}
                error={errors.preferredTimeEnd}
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {prettyTime(time)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <h3 style={{ marginTop: 22 }}>Things we should know</h3>

          <Field
            label="Permanent property notes"
            hint="Saved to your lawn forever and sent to every mower: gate location, newly seeded areas, gardens, pets, obstacles, areas that should NOT be mowed."
          >
            <TextArea
              value={form.permanentNotes}
              onChange={(e) => update('permanentNotes', e.target.value)}
              placeholder="Gate latch is on the left side of the fence. Do not mow the seeded strip along the back fence. Friendly dog in the yard most afternoons."
            />
          </Field>

          <Field label="Anything else about this visit?">
            <TextArea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Text me when you're on the way."
            />
          </Field>

          <Field label="Photos of your lawn (optional)" hint="Up to 5 photos. Helpful but never required.">
            <input
              className="input"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
          </Field>

          {files.length ? (
            <InfoBanner>
              {files.length} photo{files.length === 1 ? '' : 's'} will be uploaded
              with your request.
            </InfoBanner>
          ) : null}

          <Button type="submit" size="lg" full loading={saving}>
            {saving ? 'Sending your request…' : 'REQUEST FREE CONSULTATION'}
          </Button>
        </form>
      </Card>
    </Page>
  );
}
