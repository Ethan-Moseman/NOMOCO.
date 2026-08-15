// =============================================================================
// Admin — manage one job: edit it, price it, assign it, cancel it.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Page, SectionHeading } from '../../components/Layout';
import {
  Button,
  Card,
  DetailRow,
  ErrorBanner,
  Field,
  InfoBanner,
  Loader,
  PageHeader,
  PhotoStrip,
  Select,
  StatusBadge,
  SuccessBanner,
  TextArea,
  TextInput,
} from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import {
  adminAssignEmployee,
  adminSetJobStatus,
  adminUpdateJob,
  deleteJobCompletely,
  getBilling,
  getJob,
  markJobPaid,
  updateCustomerPrice,
  updateEmployeePay,
} from '../../services/jobs';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getAllEmployees } from '../../services/users';
import { recordEarning } from '../../services/earnings';
import {
  COLLECTIONS,
  JOB_STATUS,
  JOB_STATUS_LABELS,
  PAYMENT_STATUS,
  TIME_OPTIONS,
} from '../../lib/constants';
import {
  friendlyError,
  mapsUrl,
  money,
  prettyDate,
  prettyStamp,
  prettyTime,
} from '../../lib/format';

export default function AdminJobDetail() {
  const { jobId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [billing, setBilling] = useState(null);
  const [pay, setPay] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [schedule, setSchedule] = useState({
    requestedDate: '',
    timeStart: '',
    timeEnd: '',
    temporaryNotes: '',
  });
  const [payInput, setPayInput] = useState('');
  const [priceInput, setPriceInput] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [foundJob, foundBilling, paySnap, roster] = await Promise.all([
        getJob(jobId),
        getBilling(jobId),
        getDoc(doc(db, COLLECTIONS.JOB_PAY, jobId)),
        getAllEmployees(),
      ]);

      setJob(foundJob);
      setBilling(foundBilling);
      setPay(paySnap.exists() ? Number(paySnap.data().employeePay) : null);
      setEmployees(roster.filter((employee) => employee.approved));

      if (foundJob) {
        setSchedule({
          requestedDate: foundJob.requestedDate || '',
          timeStart: foundJob.timeStart || '09:00',
          timeEnd: foundJob.timeEnd || '17:00',
          temporaryNotes: foundJob.temporaryNotes || '',
        });
      }
      setPayInput(paySnap.exists() ? String(paySnap.data().employeePay) : '');
      setPriceInput(
        foundBilling?.customerPrice != null ? String(foundBilling.customerPrice) : ''
      );
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setLoading(false);
    }
  }, [jobId]);

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

  if (loading) return <Loader label="Loading job…" />;
  if (!job) {
    return (
      <Page width="wide">
        <PageHeader title="Job not found" back="/admin" />
      </Page>
    );
  }

  return (
    <Page width="wide">
      <PageHeader title={job.address} subtitle={job.customerName} back="/admin" />

      <ErrorBanner>{error}</ErrorBanner>
      <SuccessBanner>{notice}</SuccessBanner>

      <Card>
        <div className="job-card-head">
          <div>
            <p className="job-address">{prettyDate(job.requestedDate)}</p>
            <p className="job-when">
              {prettyTime(job.timeStart)} – {prettyTime(job.timeEnd)}
            </p>
          </div>
          <StatusBadge status={job.status} />
        </div>

        <DetailRow label="Customer price" value={money(billing?.customerPrice)} />
        <DetailRow label="Employee pay" value={money(pay)} />
        <DetailRow
          label="Profit"
          value={money(Number(billing?.customerPrice || 0) - Number(pay || 0))}
          strong
        />
        <DetailRow label="Accepted by" value={job.assignedEmployeeName || 'Nobody yet'} />
        <DetailRow
          label="Payment"
          value={billing?.paymentStatus === PAYMENT_STATUS.PAID ? 'Paid' : 'Unpaid'}
        />
        {job.startedAt ? <DetailRow label="Started" value={prettyStamp(job.startedAt)} /> : null}
        {job.completedAt ? (
          <DetailRow label="Completed" value={prettyStamp(job.completedAt)} />
        ) : null}

        <Button href={mapsUrl(job.address)} variant="ghost" full target="_blank" rel="noreferrer">
          Open in Maps
        </Button>
      </Card>

      {job.permanentNotes ? (
        <div className="note-block">
          <span className="note-label">Permanent property notes</span>
          {job.permanentNotes}
        </div>
      ) : null}
      {job.completionPhotoUrl ? <PhotoStrip photos={[job.completionPhotoUrl]} /> : null}

      {/* --------------------------------------------------------------- money */}
      <SectionHeading>Money</SectionHeading>
      <Card>
        <Field label="Employee pay for this job" hint="Employees can see this. Customers cannot.">
          <div className="row">
            <TextInput
              type="number"
              min="1"
              inputMode="decimal"
              value={payInput}
              onChange={(e) => setPayInput(e.target.value)}
              placeholder="27"
            />
            <Button
              style={{ flex: '0 0 auto' }}
              onClick={() => {
                const amount = Number(payInput);
                if (!Number.isFinite(amount) || amount <= 0) {
                  return setError('Enter an employee pay greater than zero.');
                }
                run(
                  () => updateEmployeePay(jobId, amount, user.uid),
                  `Employee pay set to ${money(amount)}.`
                );
              }}
            >
              Save pay
            </Button>
          </div>
        </Field>

        <Field
          label="Customer price for this job"
          hint="Employees can NEVER read this — it lives in a separate collection they are denied."
        >
          <div className="row">
            <TextInput
              type="number"
              min="1"
              inputMode="decimal"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="42"
            />
            <Button
              style={{ flex: '0 0 auto' }}
              onClick={() => {
                const amount = Number(priceInput);
                if (!Number.isFinite(amount) || amount <= 0) {
                  return setError('Enter a customer price greater than zero.');
                }
                run(
                  () => updateCustomerPrice(jobId, amount),
                  `Customer price set to ${money(amount)}.`
                );
              }}
            >
              Save price
            </Button>
          </div>
        </Field>

        {billing?.paymentStatus !== PAYMENT_STATUS.PAID ? (
          <Button full variant="secondary" onClick={() => run(() => markJobPaid(jobId), 'Marked as paid.')}>
            Mark customer as paid
          </Button>
        ) : (
          <InfoBanner>Paid {prettyStamp(billing?.paidAt)}.</InfoBanner>
        )}

        {job.status === JOB_STATUS.COMPLETED && job.assignedEmployeeId ? (
          <Button
            full
            variant="ghost"
            style={{ marginTop: 8 }}
            onClick={() =>
              run(
                () =>
                  recordEarning({
                    jobId,
                    employeeId: job.assignedEmployeeId,
                    employeeName: job.assignedEmployeeName,
                    amount: pay || 0,
                    jobLabel: `${job.address} — ${prettyDate(job.requestedDate)}`,
                  }),
                'Earning recorded for this mower.'
              )
            }
          >
            Log {money(pay)} to {job.assignedEmployeeName}
          </Button>
        ) : null}
      </Card>

      {/* ------------------------------------------------------------ schedule */}
      <SectionHeading>Schedule &amp; notes</SectionHeading>
      <Card>
        <Field label="Date">
          <TextInput
            type="date"
            value={schedule.requestedDate}
            onChange={(e) => setSchedule({ ...schedule, requestedDate: e.target.value })}
          />
        </Field>
        <div className="row">
          <Field label="Earliest time">
            <Select
              value={schedule.timeStart}
              onChange={(e) => setSchedule({ ...schedule, timeStart: e.target.value })}
            >
              {TIME_OPTIONS.map((time) => (
                <option key={time} value={time}>
                  {prettyTime(time)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Latest time">
            <Select
              value={schedule.timeEnd}
              onChange={(e) => setSchedule({ ...schedule, timeEnd: e.target.value })}
            >
              {TIME_OPTIONS.map((time) => (
                <option key={time} value={time}>
                  {prettyTime(time)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Notes for this mow only">
          <TextArea
            value={schedule.temporaryNotes}
            onChange={(e) => setSchedule({ ...schedule, temporaryNotes: e.target.value })}
          />
        </Field>
        <Button full onClick={() => run(() => adminUpdateJob(jobId, schedule), 'Job updated.')}>
          Save job
        </Button>
      </Card>

      {/* ---------------------------------------------------------- assignment */}
      <SectionHeading>Assignment &amp; status</SectionHeading>
      <Card>
        <Field label="Assign a mower directly" hint="Skips the available-jobs board.">
          <Select
            value={job.assignedEmployeeId || ''}
            onChange={(e) => {
              const chosen = employees.find((employee) => employee.uid === e.target.value);
              run(
                () =>
                  adminAssignEmployee(
                    jobId,
                    chosen ? { id: chosen.uid, fullName: chosen.fullName } : null
                  ),
                chosen ? `Assigned to ${chosen.fullName}.` : 'Returned to the job board.'
              );
            }}
          >
            <option value="">— Nobody (leave on the board) —</option>
            {employees.map((employee) => (
              <option key={employee.uid} value={employee.uid}>
                {employee.fullName}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Force a status" hint="Use sparingly — normally the flow sets this itself.">
          <Select
            value={job.status}
            onChange={(e) =>
              run(() => adminSetJobStatus(jobId, e.target.value), 'Status changed.')
            }
          >
            {Object.values(JOB_STATUS).map((status) => (
              <option key={status} value={status}>
                {JOB_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </Field>

        <Button
          variant="danger"
          full
          onClick={() => {
            if (!window.confirm('Delete this job and its money records? This cannot be undone.')) {
              return;
            }
            run(async () => {
              await deleteJobCompletely(jobId);
              navigate('/admin');
            });
          }}
        >
          Delete job
        </Button>
      </Card>
    </Page>
  );
}
