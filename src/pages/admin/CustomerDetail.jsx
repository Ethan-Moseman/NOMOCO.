// =============================================================================
// Admin — one customer, everything about them on a single page.
// =============================================================================
// Name, email, phone, address, property notes, consultation history, their
// price, upcoming and previous jobs, and payment history.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, SectionHeading } from '../../components/Layout';
import {
  Button,
  Card,
  DetailRow,
  EmptyState,
  ErrorBanner,
  Field,
  Loader,
  PageHeader,
  PhotoStrip,
  StatusBadge,
  SuccessBanner,
  TextArea,
  TextInput,
} from '../../components/UI';
import {
  getAllProperties,
  setCustomerPrice,
  updatePropertyDetails,
} from '../../services/properties';
import { getAllConsultations } from '../../services/consultations';
import { getAllBilling, getAllJobs, getAllPay, markJobPaid } from '../../services/jobs';
import { getUser } from '../../services/users';
import { JOB_STATUS, PAYMENT_STATUS } from '../../lib/constants';
import {
  friendlyError,
  fullAddress,
  money,
  prettyDate,
  prettyWindow,
} from '../../lib/format';

export default function AdminCustomerDetail() {
  const { userId } = useParams();

  const [customer, setCustomer] = useState(null);
  const [property, setProperty] = useState(null);
  const [consultations, setConsultations] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [payMap, setPayMap] = useState({});
  const [billingMap, setBillingMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [edit, setEdit] = useState({
    addressLine1: '',
    city: '',
    state: '',
    zip: '',
    permanentNotes: '',
  });
  const [price, setPrice] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [account, properties, allConsultations, allJobs, pay, billing] =
        await Promise.all([
          getUser(userId),
          getAllProperties(),
          getAllConsultations(),
          getAllJobs(),
          getAllPay(),
          getAllBilling(),
        ]);

      const theirProperty = properties.find((row) => row.ownerId === userId) || null;

      setCustomer(account);
      setProperty(theirProperty);
      setConsultations(allConsultations.filter((row) => row.ownerId === userId));
      setJobs(allJobs.filter((row) => row.ownerId === userId));
      setPayMap(pay);
      setBillingMap(billing);

      if (theirProperty) {
        setEdit({
          addressLine1: theirProperty.addressLine1 || '',
          city: theirProperty.city || '',
          state: theirProperty.state || '',
          zip: theirProperty.zip || '',
          permanentNotes: theirProperty.permanentNotes || '',
        });
        setPrice(
          theirProperty.customerPrice != null ? String(theirProperty.customerPrice) : ''
        );
      }
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action, message) {
    setError('');
    setNotice('');
    try {
      await action();
      if (message) setNotice(message);
      await load();
    } catch (caught) {
      setError(friendlyError(caught));
    }
  }

  if (loading) return <Loader label="Loading customer…" />;

  if (!customer) {
    return (
      <Page width="wide">
        <PageHeader title="Customer not found" back="/admin" />
      </Page>
    );
  }

  const upcoming = jobs.filter((job) =>
    [JOB_STATUS.REQUESTED, JOB_STATUS.AVAILABLE, JOB_STATUS.ACCEPTED, JOB_STATUS.IN_PROGRESS].includes(
      job.status
    )
  );
  const previous = jobs.filter((job) =>
    [JOB_STATUS.COMPLETED, JOB_STATUS.PAID, JOB_STATUS.CANCELLED].includes(job.status)
  );

  return (
    <Page width="wide">
      <PageHeader title={customer.fullName} subtitle={customer.email} back="/admin" />

      <ErrorBanner>{error}</ErrorBanner>
      <SuccessBanner>{notice}</SuccessBanner>

      <Card>
        <DetailRow label="Phone" value={<a href={`tel:${customer.phone}`}>{customer.phone}</a>} />
        <DetailRow label="Email" value={customer.email} />
        <DetailRow label="Address" value={property ? fullAddress(property) : '—'} />
        <DetailRow
          label="Price per mow"
          value={property?.customerPrice != null ? money(property.customerPrice) : 'Not set'}
          strong={property?.customerPrice != null}
        />
        <DetailRow
          label="Property status"
          value={property?.approved ? 'Approved' : 'Not approved yet'}
        />
      </Card>

      {property ? (
        <>
          <SectionHeading>Price</SectionHeading>
          <Card>
            <Field label="Customer price per mow" hint="Only admins can change this.">
              <div className="row">
                <TextInput
                  type="number"
                  inputMode="decimal"
                  min="1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="42"
                />
                <Button
                  style={{ flex: '0 0 auto' }}
                  onClick={() => {
                    const amount = Number(price);
                    if (!Number.isFinite(amount) || amount <= 0) {
                      return setError('Enter a price greater than zero.');
                    }
                    run(
                      () => setCustomerPrice(property.id, amount),
                      `Price updated to ${money(amount)}.`
                    );
                  }}
                >
                  Save price
                </Button>
              </div>
            </Field>
          </Card>

          <SectionHeading>Property &amp; permanent notes</SectionHeading>
          <Card>
            <Field label="Street address">
              <TextInput
                value={edit.addressLine1}
                onChange={(e) => setEdit({ ...edit, addressLine1: e.target.value })}
              />
            </Field>
            <div className="row">
              <Field label="City">
                <TextInput
                  value={edit.city}
                  onChange={(e) => setEdit({ ...edit, city: e.target.value })}
                />
              </Field>
              <Field label="State">
                <TextInput
                  maxLength={2}
                  value={edit.state}
                  onChange={(e) => setEdit({ ...edit, state: e.target.value })}
                />
              </Field>
              <Field label="ZIP">
                <TextInput
                  value={edit.zip}
                  onChange={(e) => setEdit({ ...edit, zip: e.target.value })}
                />
              </Field>
            </div>
            <Field
              label="Permanent notes"
              hint="Copied onto every future job automatically."
            >
              <TextArea
                value={edit.permanentNotes}
                onChange={(e) => setEdit({ ...edit, permanentNotes: e.target.value })}
              />
            </Field>
            <Button
              full
              onClick={() =>
                run(
                  () => updatePropertyDetails(property.id, edit),
                  'Property updated.'
                )
              }
            >
              Save property
            </Button>
            <PhotoStrip photos={property.photos} />
          </Card>
        </>
      ) : null}

      <SectionHeading>Consultations</SectionHeading>
      {consultations.length === 0 ? (
        <EmptyState title="No consultations" />
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
                <span className="note-label">Note</span>
                {consultation.notes}
              </div>
            ) : null}
            <PhotoStrip photos={consultation.photos} />
          </Card>
        ))
      )}

      <SectionHeading>Upcoming jobs</SectionHeading>
      {upcoming.length === 0 ? (
        <EmptyState title="Nothing upcoming" />
      ) : (
        upcoming.map((job) => (
          <JobSummary
            key={job.id}
            job={job}
            customerPrice={billingMap[job.id]?.customerPrice}
            employeePay={payMap[job.id]}
          />
        ))
      )}

      <SectionHeading>Previous jobs &amp; payment history</SectionHeading>
      {previous.length === 0 ? (
        <EmptyState title="No history yet" />
      ) : (
        previous.map((job) => {
          const bill = billingMap[job.id];
          return (
            <JobSummary
              key={job.id}
              job={job}
              customerPrice={bill?.customerPrice}
              employeePay={payMap[job.id]}
              paymentStatus={bill?.paymentStatus}
              onMarkPaid={
                bill?.paymentStatus !== PAYMENT_STATUS.PAID
                  ? () => run(() => markJobPaid(job.id), 'Marked as paid.')
                  : null
              }
            />
          );
        })
      )}
    </Page>
  );
}

function JobSummary({ job, customerPrice, employeePay, paymentStatus, onMarkPaid }) {
  return (
    <Card>
      <div className="job-card-head">
        <div>
          <p className="job-address">{prettyDate(job.requestedDate)}</p>
          <p className="job-when">{prettyWindow(job.timeStart, job.timeEnd)}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>
      <DetailRow label="Customer price" value={money(customerPrice)} />
      <DetailRow label="Employee pay" value={money(employeePay)} />
      {job.assignedEmployeeName ? (
        <DetailRow label="Mower" value={job.assignedEmployeeName} />
      ) : null}
      {paymentStatus ? (
        <DetailRow
          label="Payment"
          value={paymentStatus === PAYMENT_STATUS.PAID ? 'Paid' : 'Unpaid'}
        />
      ) : null}
      {onMarkPaid ? (
        <Button size="sm" full onClick={onMarkPaid}>
          Mark paid
        </Button>
      ) : null}
    </Card>
  );
}
