// =============================================================================
// My Account — contact details, property address, permanent notes, photos.
// =============================================================================
// Everything on this page is editable by the customer EXCEPT the price and the
// approval flag, which only an admin can change (enforced in firestore.rules).
// =============================================================================

import { useEffect, useState } from 'react';
import { Page, SectionHeading } from '../../components/Layout';
import {
  Button,
  Card,
  DetailRow,
  ErrorBanner,
  Field,
  Loader,
  PageHeader,
  PhotoStrip,
  SuccessBanner,
  TextArea,
  TextInput,
} from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { getPropertiesForOwner, updatePropertyDetails } from '../../services/properties';
import { updateOwnProfile } from '../../services/users';
import { uploadPhotos } from '../../services/photos';
import { formatPhoneInput, friendlyError, isValidPhone, money } from '../../lib/format';

export default function MyAccount() {
  const { user, profile, refreshProfile, role } = useAuth();

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingProperty, setSavingProperty] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [me, setMe] = useState({ fullName: '', phone: '' });
  const [lawn, setLawn] = useState({
    addressLine1: '',
    city: '',
    state: 'WI',
    zip: '',
    permanentNotes: '',
  });

  useEffect(() => {
    let cancelled = false;

    getPropertiesForOwner(user.uid)
      .then((properties) => {
        if (cancelled) return;
        const found = properties[0] || null;
        setProperty(found);
        if (found) {
          setLawn({
            addressLine1: found.addressLine1 || '',
            city: found.city || '',
            state: found.state || 'WI',
            zip: found.zip || '',
            permanentNotes: found.permanentNotes || '',
          });
        }
      })
      .catch((caught) => !cancelled && setError(friendlyError(caught)))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [user.uid]);

  useEffect(() => {
    setMe({ fullName: profile?.fullName || '', phone: profile?.phone || '' });
  }, [profile]);

  async function saveProfile(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!me.fullName.trim()) return setError('Please enter your name.');
    if (!isValidPhone(me.phone)) return setError('Please enter a 10-digit phone number.');

    setSavingProfile(true);
    try {
      await updateOwnProfile(user.uid, me);
      await refreshProfile();
      setNotice('Your details are saved.');
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveProperty(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!property) return;

    setSavingProperty(true);
    try {
      await updatePropertyDetails(property.id, lawn);
      setProperty({ ...property, ...lawn });
      setNotice('Your property is saved.');
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setSavingProperty(false);
    }
  }

  async function addPhotos(files) {
    if (!property || !files.length) return;
    setError('');
    try {
      const urls = await uploadPhotos(user.uid, files, 'propertyPhotos');
      const photos = [...(property.photos || []), ...urls];
      await updatePropertyDetails(property.id, { ...lawn, photos });
      setProperty({ ...property, photos });
      setNotice('Photos added.');
    } catch (caught) {
      setError(friendlyError(caught));
    }
  }

  if (loading) return <Loader label="Loading your account…" />;

  return (
    <Page>
      <PageHeader
        title="My Account"
        back={role === 'employee' ? '/employee' : '/dashboard'}
      />

      <ErrorBanner>{error}</ErrorBanner>
      <SuccessBanner>{notice}</SuccessBanner>

      <SectionHeading>Your Details</SectionHeading>
      <Card>
        <form onSubmit={saveProfile}>
          <Field label="Full name" required>
            <TextInput
              value={me.fullName}
              onChange={(e) => setMe({ ...me, fullName: e.target.value })}
              autoComplete="name"
            />
          </Field>
          <Field label="Phone number" required>
            <TextInput
              type="tel"
              inputMode="tel"
              value={me.phone}
              onChange={(e) => setMe({ ...me, phone: formatPhoneInput(e.target.value) })}
              autoComplete="tel"
            />
          </Field>
          <Field label="Email" hint="Contact us if you need to change your email address.">
            <TextInput value={profile?.email || user.email || ''} disabled />
          </Field>
          <Button type="submit" full loading={savingProfile}>
            Save my details
          </Button>
        </form>
      </Card>

      {property ? (
        <>
          <SectionHeading>My Property</SectionHeading>
          <Card>
            <DetailRow
              label="Price per mow"
              value={property.customerPrice != null ? money(property.customerPrice) : 'Set after your consultation'}
              strong={property.customerPrice != null}
            />
            <DetailRow
              label="Status"
              value={property.approved ? 'Approved for mowing' : 'Awaiting consultation'}
            />
          </Card>

          <Card style={{ marginTop: 12 }}>
            <form onSubmit={saveProperty}>
              <Field label="Street address" required>
                <TextInput
                  value={lawn.addressLine1}
                  onChange={(e) => setLawn({ ...lawn, addressLine1: e.target.value })}
                  autoComplete="address-line1"
                />
              </Field>
              <div className="row">
                <Field label="City" required>
                  <TextInput
                    value={lawn.city}
                    onChange={(e) => setLawn({ ...lawn, city: e.target.value })}
                  />
                </Field>
                <Field label="State" required>
                  <TextInput
                    value={lawn.state}
                    maxLength={2}
                    onChange={(e) => setLawn({ ...lawn, state: e.target.value })}
                  />
                </Field>
                <Field label="ZIP" required>
                  <TextInput
                    inputMode="numeric"
                    value={lawn.zip}
                    onChange={(e) =>
                      setLawn({ ...lawn, zip: e.target.value.replace(/\D/g, '').slice(0, 5) })
                    }
                  />
                </Field>
              </div>

              <Field
                label="Permanent property notes"
                hint="Sent to every mower, every time: gate location, newly seeded areas, gardens, pets, obstacles, areas that should NOT be mowed."
              >
                <TextArea
                  value={lawn.permanentNotes}
                  onChange={(e) => setLawn({ ...lawn, permanentNotes: e.target.value })}
                />
              </Field>

              <Button type="submit" full loading={savingProperty}>
                Save my property
              </Button>
            </form>

            <Field label="Add lawn photos (optional)" hint="Up to 5 at a time.">
              <input
                className="input"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => addPhotos(Array.from(e.target.files || []))}
              />
            </Field>
            <PhotoStrip photos={property.photos} />
          </Card>
        </>
      ) : (
        <Card>
          <h3>No property yet</h3>
          <p className="muted small">
            Your property gets created when you request your free consultation.
          </p>
          <Button as="link" to="/request-consultation" full>
            REQUEST A FREE LAWN CONSULTATION
          </Button>
        </Card>
      )}
    </Page>
  );
}
