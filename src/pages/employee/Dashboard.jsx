// =============================================================================
// Employee dashboard — AVAILABLE JOBS and MY JOBS.
// =============================================================================
// READ THIS BEFORE ADDING ANYTHING TO THIS PAGE:
//
// The only two collections this screen touches are `jobs` (no money in it at
// all) and `jobPay` (this employee's pay). It does NOT import anything that
// reads `jobBilling`, and it must never start doing so — that is where the
// customer's price lives. Even if someone added the import by mistake, the
// security rules would refuse the read for an employee account.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Page, SectionHeading } from '../../components/Layout';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Loader,
  StatusBadge,
  Tabs,
} from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { attachPay, getAvailableJobs, getJobsForEmployee } from '../../services/jobs';
import { getEarningsForEmployee } from '../../services/earnings';
import { EARNING_STATUS, JOB_STATUS } from '../../lib/constants';
import {
  friendlyError,
  money,
  prettyDate,
  prettyWindow,
  todayISO,
} from '../../lib/format';

export default function EmployeeDashboard() {
  const { user, profile } = useAuth();

  const [tab, setTab] = useState('available');
  const [available, setAvailable] = useState([]);
  const [mine, setMine] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [availableJobs, myJobs, myEarnings] = await Promise.all([
        getAvailableJobs(),
        getJobsForEmployee(user.uid),
        getEarningsForEmployee(user.uid).catch(() => []),
      ]);

      // attachPay reads jobPay/{jobId} one document at a time. Each read is
      // permitted only because the job is available or assigned to this user.
      const [availableWithPay, mineWithPay] = await Promise.all([
        attachPay(availableJobs),
        attachPay(myJobs),
      ]);

      setAvailable(availableWithPay);
      setMine(mineWithPay);
      setEarnings(myEarnings);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setLoading(false);
    }
  }, [user.uid]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loader label="Loading jobs…" />;

  const today = todayISO();
  const todaysJobs = mine.filter(
    (job) => job.requestedDate === today && job.status !== JOB_STATUS.COMPLETED
  );
  const upcomingJobs = mine.filter(
    (job) =>
      job.requestedDate > today &&
      [JOB_STATUS.ACCEPTED, JOB_STATUS.IN_PROGRESS].includes(job.status)
  );
  const completedJobs = mine.filter((job) =>
    [JOB_STATUS.COMPLETED, JOB_STATUS.PAID].includes(job.status)
  );
  const owed = earnings
    .filter((earning) => earning.status === EARNING_STATUS.OWED)
    .reduce((sum, earning) => sum + Number(earning.amount || 0), 0);

  return (
    <Page>
      <header className="page-header">
        <h1>Hi{profile?.fullName ? `, ${profile.fullName.split(' ')[0]}` : ''}</h1>
        <p className="page-subtitle">
          {available.length} job{available.length === 1 ? '' : 's'} available ·{' '}
          {money(owed)} owed to you
        </p>
      </header>

      <ErrorBanner>{error}</ErrorBanner>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'available', label: 'Available Jobs', count: available.length },
          { id: 'mine', label: 'My Jobs', count: todaysJobs.length + upcomingJobs.length },
          { id: 'earnings', label: 'My Earnings' },
        ]}
      />

      {/* ------------------------------------------------------ AVAILABLE */}
      {tab === 'available' ? (
        <>
          <SectionHeading action={<Button size="sm" variant="ghost" onClick={load}>Refresh</Button>}>
            Available Jobs
          </SectionHeading>

          {available.length === 0 ? (
            <EmptyState
              title="No jobs available right now"
              message="Check back soon — new lawns show up here as they are released."
            />
          ) : (
            available.map((job) => <AvailableJobCard key={job.id} job={job} />)
          )}
        </>
      ) : null}

      {/* ----------------------------------------------------------- MINE */}
      {tab === 'mine' ? (
        <>
          <SectionHeading>Today</SectionHeading>
          {todaysJobs.length === 0 ? (
            <EmptyState title="Nothing on today" />
          ) : (
            todaysJobs.map((job) => <MyJobCard key={job.id} job={job} />)
          )}

          <SectionHeading>Upcoming</SectionHeading>
          {upcomingJobs.length === 0 ? (
            <EmptyState title="Nothing upcoming" />
          ) : (
            upcomingJobs.map((job) => <MyJobCard key={job.id} job={job} />)
          )}

          <SectionHeading>Completed</SectionHeading>
          {completedJobs.length === 0 ? (
            <EmptyState title="No completed jobs yet" />
          ) : (
            completedJobs.map((job) => <MyJobCard key={job.id} job={job} />)
          )}
        </>
      ) : null}

      {/* ------------------------------------------------------- EARNINGS */}
      {tab === 'earnings' ? (
        <>
          <SectionHeading>My Earnings</SectionHeading>
          {earnings.length === 0 ? (
            <EmptyState
              title="No earnings recorded yet"
              message="Completed jobs show up here once they are logged."
            />
          ) : (
            <Card>
              {earnings.map((earning) => (
                <div key={earning.id} className="detail-row">
                  <span className="detail-label">
                    {earning.jobLabel}
                    {earning.status === EARNING_STATUS.PAID ? ' · paid' : ''}
                  </span>
                  <span className="detail-value">{money(earning.amount)}</span>
                </div>
              ))}
              <div className="total-row">
                <span>Owed to you</span>
                <span>{money(owed)}</span>
              </div>
            </Card>
          )}
          <p className="small muted center" style={{ marginTop: 10 }}>
            Payouts are handled directly by NO MO CO. — see your manager.
          </p>
        </>
      ) : null}
    </Page>
  );
}

/**
 * An available job card. Shows exactly what the requirement asked for:
 * address, day, time window, notes, and YOUR PAY.
 */
function AvailableJobCard({ job }) {
  return (
    <Card>
      <div className="job-card-head">
        <div>
          <p className="job-address">{job.address}</p>
          <p className="job-when">
            {prettyDate(job.requestedDate)}, {prettyWindow(job.timeStart, job.timeEnd)}
          </p>
        </div>
      </div>

      <div className="pay-highlight">
        <span className="pay-label">Your pay</span>
        <span className="pay-value">{money(job.employeePay)}</span>
      </div>

      {job.permanentNotes ? (
        <div className="note-block">
          <span className="note-label">Property notes</span>
          {job.permanentNotes}
        </div>
      ) : null}

      <Button as="link" to={`/employee/job/${job.id}`} size="lg" full>
        VIEW JOB
      </Button>
    </Card>
  );
}

/** A job this employee already owns. */
function MyJobCard({ job }) {
  return (
    <Card>
      <div className="job-card-head">
        <div>
          <p className="job-address">{job.address}</p>
          <p className="job-when">
            {prettyDate(job.requestedDate)}, {prettyWindow(job.timeStart, job.timeEnd)}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="pay-highlight">
        <span className="pay-label">Your pay</span>
        <span className="pay-value">{money(job.employeePay)}</span>
      </div>

      <Link to={`/employee/job/${job.id}`} className="btn btn-secondary btn-full">
        OPEN JOB
      </Link>
    </Card>
  );
}
