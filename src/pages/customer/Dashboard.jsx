// =============================================================================
// Customer dashboard — "my lawn".
// =============================================================================
// Shows: my price per mow, the REQUEST A MOW button (once my lawn is
// approved), my consultation status, upcoming and past mows, my permanent
// property notes, and what I owe.
//
// Note which money this page reads: the customer's OWN price, from
// properties/{id}.customerPrice and jobBilling/{jobId}.customerPrice. It never
// touches jobPay — the customer is not supposed to see what we pay the mower,
// and the security rules would refuse the read anyway.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Page, SectionHeading } from '../../components/Layout';
import {
  Button,
  Card,
  DetailRow,
  EmptyState,
  ErrorBanner,
  InfoBanner,
  Loader,
  PhotoStrip,
  StatusBadge,
  SuccessBanner,
} from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { getPropertiesForOwner } from '../../services/properties';
import { getConsultationsForOwner } from '../../services/consultations';
import { getBillingForOwner, getJobsForOwner } from '../../services/jobs';
import { startCheckout, STRIPE_ENABLED } from '../../services/payments';
import {
  JOB_STATUS,
  PAYMENT_STATUS,
} from '../../lib/constants';
import {
  friendlyError,
  fullAddress,
  money,
  prettyDate,
  prettyWindow,
} from '../../lib/format';

const OPEN_STATUSES = [
  JOB_STATUS.REQUESTED,
  JOB_STATUS.AVAILABLE,
  JOB_STATUS.ACCEPTED,
  JOB_STATUS.IN_PROGRESS,
];

export default function CustomerDashboard() {
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();

  const [property, setProperty] = useState(null);
  const [consultations, setConsultations] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [billing, setBilling] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payingJobId, setPayingJobId] = useState(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const [properties, consultationList, jobList, billingMap] = await Promise.all([
        getPropertiesForOwner(user.uid),
        getConsultationsForOwner(user.uid),
        getJobsForOwner(user.uid),
        getBillingForOwner(user.uid),
      ]);
      setProperty(properties[0] || null);
      setConsultations(consultationList);
      setJobs(jobList);
      setBilling(billingMap);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setLoading(false);
    }
  }, [user.uid]);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePay(jobId) {
    setPayingJobId(jobId);
    setError('');
    try {
      await startCheckout(jobId);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setPayingJobId(null);
    }
  }

  if (loading) return <Loader label="Loading your lawn…" />;

  const isApproved = property?.approved && property?.customerPrice != null;
  const upcoming = jobs.filter((job) => OPEN_STATUSES.includes(job.status));
  const past = jobs.filter((job) =>
    [JOB_STATUS.COMPLETED, JOB_STATUS.PAID, JOB_STATUS.CANCELLED].includes(job.status)
  );
  const unpaidTotal = past
    .filter((job) => billing[job.id]?.paymentStatus === PAYMENT_STATUS.UNPAID
      && job.status === JOB_STATUS.COMPLETED)
    .reduce((sum, job) => sum + Number(billing[job.id]?.customerPrice || 0), 0);

  return (
    <Page>
      <header className="page-header">
        <h1>Hi{profile?.fullName ? `, ${profile.fullName.split(' ')[0]}` : ''}</h1>
        {property ? (
          <p className="page-subtitle">{fullAddress(property)}</p>
        ) : (
          <p className="page-subtitle">Let's get your lawn set up.</p>
        )}
      </header>

      <ErrorBanner>{error}</ErrorBanner>

      {searchParams.get('requested') === 'consultation' ? (
        <SuccessBanner>
          Consultation requested. We will take a look and set your price soon.
        </SuccessBanner>
      ) : null}
      {searchParams.get('requested') === 'mow' ? (
        <SuccessBanner>Mow requested. We will get a mower assigned shortly.</SuccessBanner>
      ) : null}
      {searchParams.get('paid') === '1' ? (
        <SuccessBanner>Payment received — thank you!</SuccessBanner>
      ) : null}

      {/* ------------------------------------------------- price + main action */}
      {isApproved ? (
        <>
          <div className="price-panel">
            <p className="price-label">Your price per mow</p>
            <p className="price-value">{money(property.customerPrice)}</p>
            <p className="price-note">Flat rate — no surprises.</p>
          </div>

          <Button as="link" to="/request-mow" size="lg" full>
            REQUEST A MOW
          </Button>
        </>
      ) : (
        <Card>
          <h3>Your lawn is not priced yet</h3>
          {consultations.length ? (
            <p className="muted small">
              We have your consultation request. Once we have looked at your
              lawn we will set your price per mow and this turns into a big
              REQUEST A MOW button.
            </p>
          ) : (
            <p className="muted small">
              Start with a free consultation. We look at your lawn, note
              anything important, and set one honest flat price.
            </p>
          )}
          <Button as="link" to="/request-consultation" size="lg" full>
            REQUEST A FREE LAWN CONSULTATION
          </Button>
        </Card>
      )}

      {/* --------------------------------------------------------- amount due */}
      {unpaidTotal > 0 ? (
        <InfoBanner>
          You have {money(unpaidTotal)} due for completed mowing.
        </InfoBanner>
      ) : null}

      {/* ------------------------------------------------------ consultations */}
      <SectionHeading>Consultation</SectionHeading>
      {consultations.length === 0 ? (
        <EmptyState
          title="No consultation yet"
          message="It is free and takes about a minute to request."
          action={
            <Button as="link" to="/request-consultation">
              Request one now
            </Button>
          }
        />
      ) : (
        consultations.map((consultation) => (
          <Card key={consultation.id}>
            <div className="job-card-head">
              <div>
                <p className="job-address">{prettyDate(consultation.preferredDate)}</p>
                <p className="job-when">
                  {prettyWindow(
                    consultation.preferredTimeStart,
                    consultation.preferredTimeEnd
                  )}
                </p>
              </div>
              <StatusBadge status={consultation.status} kind="consultation" />
            </div>
            {consultation.notes ? (
              <div className="note-block">
                <span className="note-label">Your note</span>
                {consultation.notes}
              </div>
            ) : null}
          </Card>
        ))
      )}

      {/* ---------------------------------------------------- upcoming mowing */}
      <SectionHeading>Upcoming Services</SectionHeading>
      {upcoming.length === 0 ? (
        <EmptyState title="Nothing scheduled" message="Request a mow whenever you are ready." />
      ) : (
        upcoming.map((job) => (
          <JobRow key={job.id} job={job} price={billing[job.id]?.customerPrice} />
        ))
      )}

      {/* -------------------------------------------------------- past mowing */}
      <SectionHeading>Past Services</SectionHeading>
      {past.length === 0 ? (
        <EmptyState title="No past mowing yet" />
      ) : (
        past.map((job) => {
          const bill = billing[job.id];
          const owes =
            job.status === JOB_STATUS.COMPLETED &&
            bill?.paymentStatus === PAYMENT_STATUS.UNPAID;

          return (
            <Card key={job.id}>
              <div className="job-card-head">
                <div>
                  <p className="job-address">{prettyDate(job.requestedDate)}</p>
                  <p className="job-when">
                    {job.status === JOB_STATUS.CANCELLED
                      ? 'Cancelled'
                      : 'Lawn complete'}
                  </p>
                </div>
                <StatusBadge status={job.status} />
              </div>

              {job.completionPhotoUrl ? (
                <PhotoStrip photos={[job.completionPhotoUrl]} />
              ) : null}

              {job.status !== JOB_STATUS.CANCELLED ? (
                <>
                  <DetailRow label="Total" value={money(bill?.customerPrice)} strong />
                  <DetailRow
                    label="Payment"
                    value={
                      bill?.paymentStatus === PAYMENT_STATUS.PAID ? 'Paid — thank you!' : 'Due'
                    }
                  />
                </>
              ) : null}

              {owes ? (
                STRIPE_ENABLED ? (
                  <Button
                    size="lg"
                    full
                    loading={payingJobId === job.id}
                    onClick={() => handlePay(job.id)}
                    style={{ marginTop: 10 }}
                  >
                    PAY NOW — {money(bill?.customerPrice)}
                  </Button>
                ) : (
                  <InfoBanner>
                    Online payment is coming soon. For now please pay your mower
                    directly — {money(bill?.customerPrice)}.
                  </InfoBanner>
                )
              ) : null}
            </Card>
          );
        })
      )}

      {/* ---------------------------------------------------- property notes */}
      {property ? (
        <>
          <SectionHeading
            action={
              <Button as="link" to="/account" variant="ghost" size="sm">
                Edit
              </Button>
            }
          >
            My Property
          </SectionHeading>
          <Card>
            <DetailRow label="Address" value={fullAddress(property)} />
            <DetailRow
              label="Price per mow"
              value={property.customerPrice != null ? money(property.customerPrice) : 'Not set yet'}
            />
            {property.permanentNotes ? (
              <div className="note-block">
                <span className="note-label">Permanent notes — every mower sees these</span>
                {property.permanentNotes}
              </div>
            ) : (
              <p className="muted small" style={{ marginTop: 10 }}>
                No permanent notes yet. <Link to="/account">Add gate location,
                pets, or areas that should not be mowed.</Link>
              </p>
            )}
            <PhotoStrip photos={property.photos} />
          </Card>
        </>
      ) : null}
    </Page>
  );
}

/** One upcoming mow. */
function JobRow({ job, price }) {
  return (
    <Card>
      <div className="job-card-head">
        <div>
          <p className="job-address">{prettyDate(job.requestedDate)}</p>
          <p className="job-when">{prettyWindow(job.timeStart, job.timeEnd)}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {job.status === JOB_STATUS.ACCEPTED && job.assignedEmployeeName ? (
        <p className="small muted">{job.assignedEmployeeName} is scheduled to mow.</p>
      ) : null}
      {job.status === JOB_STATUS.IN_PROGRESS ? (
        <p className="small muted">Your mower is on site right now.</p>
      ) : null}

      {job.temporaryNotes ? (
        <div className="note-block">
          <span className="note-label">Note for this mow</span>
          {job.temporaryNotes}
        </div>
      ) : null}

      <DetailRow label="Price" value={money(price)} />
    </Card>
  );
}
