// =============================================================================
// Employee job detail — accept it, start it, finish it.
// =============================================================================
// Same rule as the employee dashboard: this page reads `jobs` and `jobPay`
// only. The customer's price is not fetched, not cached, and not available to
// this account at the database level.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Page } from '../../components/Layout';
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
  StatusBadge,
  SuccessBanner,
} from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import {
  acceptJob,
  completeJob,
  getEmployeePay,
  getJob,
  startJob,
} from '../../services/jobs';
import { uploadPhoto } from '../../services/photos';
import { JOB_STATUS } from '../../lib/constants';
import {
  friendlyError,
  mapsUrl,
  money,
  prettyDate,
  prettyStamp,
  prettyWindow,
} from '../../lib/format';

export default function EmployeeJobDetail() {
  const { jobId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [pay, setPay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [photoFile, setPhotoFile] = useState(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const [foundJob, foundPay] = await Promise.all([
        getJob(jobId),
        getEmployeePay(jobId).catch(() => null),
      ]);
      setJob(foundJob);
      setPay(foundPay);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAccept() {
    setWorking(true);
    setError('');
    try {
      await acceptJob(jobId, {
        uid: user.uid,
        fullName: profile?.fullName || 'Mower',
      });
      setNotice('Job accepted. It is now under My Jobs.');
      await load();
    } catch (caught) {
      // Either our transaction saw it was taken, or the security rules did.
      setError(friendlyError(caught));
      await load();
    } finally {
      setWorking(false);
    }
  }

  async function handleStart() {
    setWorking(true);
    setError('');
    try {
      await startJob(jobId);
      await load();
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setWorking(false);
    }
  }

  async function handleComplete() {
    setWorking(true);
    setError('');
    try {
      let photoUrl = null;
      if (photoFile) {
        // Optional — never block finishing the job on a photo upload.
        photoUrl = await uploadPhoto(user.uid, photoFile, 'jobPhotos').catch(() => null);
      }
      await completeJob(jobId, photoUrl);
      setNotice('Nice work — the customer can see this lawn is done.');
      await load();
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <Loader label="Loading job…" />;

  if (!job) {
    return (
      <Page>
        <PageHeader title="Job not found" back="/employee" />
        <Card>
          <p className="muted">
            This job is no longer available to you — another mower may have
            accepted it.
          </p>
          <Button onClick={() => navigate('/employee')} full>
            Back to available jobs
          </Button>
        </Card>
      </Page>
    );
  }

  const isMine = job.assignedEmployeeId === user.uid;
  const isAvailable = job.status === JOB_STATUS.AVAILABLE;

  return (
    <Page>
      <PageHeader title={job.address} back="/employee" />

      <ErrorBanner>{error}</ErrorBanner>
      <SuccessBanner>{notice}</SuccessBanner>

      {!isMine && !isAvailable ? (
        <InfoBanner>Another mower has already accepted this job.</InfoBanner>
      ) : null}

      <Card>
        <div className="job-card-head">
          <div>
            <p className="job-address">{prettyDate(job.requestedDate)}</p>
            <p className="job-when">{prettyWindow(job.timeStart, job.timeEnd)}</p>
          </div>
          <StatusBadge status={job.status} />
        </div>

        <div className="pay-highlight">
          <span className="pay-label">Your pay</span>
          <span className="pay-value">{money(pay)}</span>
        </div>

        <DetailRow label="Address" value={job.address} />
        <DetailRow label="Customer" value={job.customerName} />
        {job.startedAt ? <DetailRow label="Started" value={prettyStamp(job.startedAt)} /> : null}
        {job.completedAt ? (
          <DetailRow label="Completed" value={prettyStamp(job.completedAt)} />
        ) : null}

        {/* Opens Apple Maps on iPhone and Google Maps everywhere else. */}
        <Button
          href={mapsUrl(job.address)}
          variant="ghost"
          full
          target="_blank"
          rel="noreferrer"
          style={{ marginTop: 10 }}
        >
          Open in Maps
        </Button>
      </Card>

      {job.permanentNotes ? (
        <div className="note-block">
          <span className="note-label">Permanent property instructions</span>
          {job.permanentNotes}
        </div>
      ) : null}

      {job.temporaryNotes ? (
        <div className="note-block">
          <span className="note-label">Notes for this visit only</span>
          {job.temporaryNotes}
        </div>
      ) : null}

      {job.completionPhotoUrl ? <PhotoStrip photos={[job.completionPhotoUrl]} /> : null}

      {/* ------------------------------------------------------- the actions */}
      <div className="stack" style={{ marginTop: 16 }}>
        {isAvailable ? (
          <Button size="lg" full loading={working} onClick={handleAccept}>
            ACCEPT JOB
          </Button>
        ) : null}

        {isMine && job.status === JOB_STATUS.ACCEPTED ? (
          <Button size="lg" full loading={working} onClick={handleStart}>
            START JOB
          </Button>
        ) : null}

        {isMine && job.status === JOB_STATUS.IN_PROGRESS ? (
          <>
            <Field label="Finished photo (optional)">
              <input
                className="input"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              />
            </Field>
            <Button size="lg" full loading={working} onClick={handleComplete}>
              MARK COMPLETE
            </Button>
          </>
        ) : null}

        {isMine &&
        [JOB_STATUS.COMPLETED, JOB_STATUS.PAID].includes(job.status) ? (
          <InfoBanner>This job is finished. {money(pay)} has been earned.</InfoBanner>
        ) : null}
      </div>
    </Page>
  );
}
