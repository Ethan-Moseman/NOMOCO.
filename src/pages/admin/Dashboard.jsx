// =============================================================================
// Admin dashboard — the whole business on one screen, in tabs.
// =============================================================================
// Tabs: Consultations · Customers · Jobs · Employees · Payments · Earnings
//
// This is the ONLY role that can read both money collections, so it is the
// only place you will see customerPrice and employeePay side by side.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Page, SectionHeading } from '../../components/Layout';
import {
  Button,
  Card,
  DetailRow,
  EmptyState,
  ErrorBanner,
  Field,
  InfoBanner,
  Loader,
  StatusBadge,
  SuccessBanner,
  Tabs,
  TextInput,
} from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import {
  getAllConsultations,
  setConsultationStatus,
} from '../../services/consultations';
import {
  approvePropertyAndSetPrice,
  getAllProperties,
  setCustomerPrice,
} from '../../services/properties';
import {
  getAllBilling,
  getAllJobs,
  getAllPay,
  markJobPaid,
  setEmployeePayAndPublish,
  updateEmployeePay,
} from '../../services/jobs';
import {
  approveEmployee,
  getAllEmployees,
  getAllUsers,
  removeEmployee,
  suspendEmployee,
} from '../../services/users';
import {
  getAllEarnings,
  markEarningPaid,
  recordEarning,
  summarizeByEmployee,
} from '../../services/earnings';
import {
  CONSULTATION_STATUS,
  JOB_STATUS,
  PAYMENT_STATUS,
  ROLES,
} from '../../lib/constants';
import {
  friendlyError,
  fullAddress,
  money,
  prettyDate,
  prettyWindow,
} from '../../lib/format';

export default function AdminDashboard() {
  const { user, setPreviewRole } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('consultations');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [
        consultations,
        properties,
        jobs,
        payMap,
        billingMap,
        users,
        employees,
        earnings,
      ] = await Promise.all([
        getAllConsultations(),
        getAllProperties(),
        getAllJobs(),
        getAllPay(),
        getAllBilling(),
        getAllUsers(),
        getAllEmployees(),
        getAllEarnings(),
      ]);
      setData({
        consultations,
        properties,
        jobs,
        payMap,
        billingMap,
        users,
        employees,
        earnings,
      });
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Wraps an action so every button gets loading + error + refresh for free. */
  async function run(action, successMessage) {
    setError('');
    setNotice('');
    try {
      await action();
      if (successMessage) setNotice(successMessage);
      await load();
    } catch (caught) {
      setError(friendlyError(caught));
    }
  }

  const totals = useMemo(() => {
    if (!data) return null;
    const revenue = Object.values(data.billingMap).reduce(
      (sum, bill) => sum + Number(bill.customerPrice || 0),
      0
    );
    const labor = Object.values(data.payMap).reduce(
      (sum, pay) => sum + Number(pay || 0),
      0
    );
    const collected = Object.values(data.billingMap)
      .filter((bill) => bill.paymentStatus === PAYMENT_STATUS.PAID)
      .reduce((sum, bill) => sum + Number(bill.customerPrice || 0), 0);
    return { revenue, labor, margin: revenue - labor, collected };
  }, [data]);

  if (loading) return <Loader label="Loading the business…" />;
  if (!data) {
    return (
      <Page width="wide">
        <ErrorBanner>{error || 'Could not load admin data.'}</ErrorBanner>
        <Button onClick={load}>Try again</Button>
      </Page>
    );
  }

  const openConsultations = data.consultations.filter((consultation) =>
    [CONSULTATION_STATUS.REQUESTED, CONSULTATION_STATUS.SCHEDULED].includes(
      consultation.status
    )
  );
  const needsPay = data.jobs.filter((job) => job.status === JOB_STATUS.REQUESTED);
  const availableJobs = data.jobs.filter((job) => job.status === JOB_STATUS.AVAILABLE);
  const activeJobs = data.jobs.filter((job) =>
    [JOB_STATUS.ACCEPTED, JOB_STATUS.IN_PROGRESS].includes(job.status)
  );
  const completedJobs = data.jobs.filter((job) =>
    [JOB_STATUS.COMPLETED, JOB_STATUS.PAID].includes(job.status)
  );

  return (
    <Page width="wide">
      <header className="page-header">
        <h1>Admin</h1>
        <p className="page-subtitle">
          {money(totals.revenue)} billed · {money(totals.labor)} labor ·{' '}
          {money(totals.margin)} gross margin
        </p>
      </header>

      <ErrorBanner>{error}</ErrorBanner>
      <SuccessBanner>{notice}</SuccessBanner>

      {/* ------------------------------------------------- safe role previews */}
      <Card>
        <p className="small muted" style={{ marginBottom: 8 }}>
          Preview the site as another role. You stay signed in as yourself — no
          impersonation, no password sharing, no weakened sign-in.
        </p>
        <div className="row">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPreviewRole(ROLES.CUSTOMER);
              navigate('/dashboard');
            }}
          >
            View As Customer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPreviewRole(ROLES.EMPLOYEE);
              navigate('/employee');
            }}
          >
            View As Employee
          </Button>
        </div>
      </Card>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'consultations', label: 'Consultations', count: openConsultations.length },
          { id: 'customers', label: 'Customers', count: data.properties.length },
          { id: 'jobs', label: 'Jobs', count: needsPay.length + availableJobs.length },
          { id: 'employees', label: 'Employees', count: data.employees.length },
          { id: 'payments', label: 'Payments' },
          { id: 'earnings', label: 'Earnings' },
        ]}
      />

      {/* =================================================== CONSULTATIONS === */}
      {tab === 'consultations' ? (
        <>
          <SectionHeading>Consultations</SectionHeading>
          {data.consultations.length === 0 ? (
            <EmptyState title="No consultation requests yet" />
          ) : (
            data.consultations.map((consultation) => {
              const property = data.properties.find(
                (candidate) => candidate.id === consultation.propertyId
              );
              return (
                <ConsultationCard
                  key={consultation.id}
                  consultation={consultation}
                  property={property}
                  onStatus={(status) =>
                    run(
                      () => setConsultationStatus(consultation.id, status),
                      'Consultation updated.'
                    )
                  }
                  onApprove={(price) =>
                    run(async () => {
                      await approvePropertyAndSetPrice(consultation.propertyId, price);
                      await setConsultationStatus(
                        consultation.id,
                        CONSULTATION_STATUS.APPROVED
                      );
                    }, `Approved. Customer price set to ${money(price)}.`)
                  }
                />
              );
            })
          )}
        </>
      ) : null}

      {/* ======================================================= CUSTOMERS === */}
      {tab === 'customers' ? (
        <>
          <SectionHeading>Customers</SectionHeading>
          {data.properties.length === 0 ? (
            <EmptyState title="No customers yet" />
          ) : (
            data.properties.map((property) => {
              const owner = data.users.find((candidate) => candidate.id === property.ownerId);
              return (
                <Card key={property.id}>
                  <div className="job-card-head">
                    <div>
                      <p className="job-address">{owner?.fullName || 'Unknown customer'}</p>
                      <p className="job-when">{fullAddress(property)}</p>
                    </div>
                    <StatusBadge
                      status={property.approved ? 'approved' : 'requested'}
                      kind="consultation"
                    />
                  </div>
                  <DetailRow
                    label="Price per mow"
                    value={property.customerPrice != null ? money(property.customerPrice) : 'Not set'}
                    strong={property.customerPrice != null}
                  />
                  <PriceForm
                    label={property.customerPrice != null ? 'Change price' : 'Set price'}
                    initial={property.customerPrice}
                    onSubmit={(price) =>
                      run(
                        () => setCustomerPrice(property.id, price),
                        `Customer price updated to ${money(price)}.`
                      )
                    }
                  />
                  <Button
                    as="link"
                    to={`/admin/customer/${property.ownerId}`}
                    variant="secondary"
                    full
                    style={{ marginTop: 8 }}
                  >
                    View full customer
                  </Button>
                </Card>
              );
            })
          )}
        </>
      ) : null}

      {/* ============================================================ JOBS === */}
      {tab === 'jobs' ? (
        <>
          <SectionHeading>Needs employee pay</SectionHeading>
          {needsPay.length === 0 ? (
            <EmptyState title="Nothing waiting" message="New mow requests appear here." />
          ) : (
            needsPay.map((job) => (
              <AdminJobCard
                key={job.id}
                job={job}
                customerPrice={data.billingMap[job.id]?.customerPrice}
                employeePay={data.payMap[job.id]}
              >
                <PriceForm
                  label="Set employee pay & release to mowers"
                  buttonLabel="MAKE AVAILABLE"
                  onSubmit={(pay) =>
                    run(
                      () => setEmployeePayAndPublish(job.id, pay, user.uid),
                      `Job released at ${money(pay)} employee pay.`
                    )
                  }
                />
              </AdminJobCard>
            ))
          )}

          <SectionHeading>Available to mowers</SectionHeading>
          {availableJobs.length === 0 ? (
            <EmptyState title="No jobs on the board" />
          ) : (
            availableJobs.map((job) => (
              <AdminJobCard
                key={job.id}
                job={job}
                customerPrice={data.billingMap[job.id]?.customerPrice}
                employeePay={data.payMap[job.id]}
              >
                <PriceForm
                  label="Change employee pay"
                  initial={data.payMap[job.id]}
                  onSubmit={(pay) =>
                    run(
                      () => updateEmployeePay(job.id, pay, user.uid),
                      `Employee pay updated to ${money(pay)}.`
                    )
                  }
                />
              </AdminJobCard>
            ))
          )}

          <SectionHeading>Accepted &amp; in progress</SectionHeading>
          {activeJobs.length === 0 ? (
            <EmptyState title="Nothing in progress" />
          ) : (
            activeJobs.map((job) => (
              <AdminJobCard
                key={job.id}
                job={job}
                customerPrice={data.billingMap[job.id]?.customerPrice}
                employeePay={data.payMap[job.id]}
              />
            ))
          )}

          <SectionHeading>Completed</SectionHeading>
          {completedJobs.length === 0 ? (
            <EmptyState title="No completed jobs yet" />
          ) : (
            completedJobs.map((job) => {
              const bill = data.billingMap[job.id];
              const pay = data.payMap[job.id];
              const earningLogged = data.earnings.some(
                (earning) => earning.jobId === job.id
              );

              return (
                <AdminJobCard key={job.id} job={job} customerPrice={bill?.customerPrice} employeePay={pay}>
                  <div className="row" style={{ marginTop: 8 }}>
                    {bill?.paymentStatus !== PAYMENT_STATUS.PAID ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          run(() => markJobPaid(job.id), 'Marked as paid.')
                        }
                      >
                        Mark customer paid
                      </Button>
                    ) : (
                      <span className="badge badge-good">Customer paid</span>
                    )}

                    {job.assignedEmployeeId && !earningLogged ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          run(
                            () =>
                              recordEarning({
                                jobId: job.id,
                                employeeId: job.assignedEmployeeId,
                                employeeName: job.assignedEmployeeName,
                                amount: pay || 0,
                                jobLabel: `${job.address} — ${prettyDate(job.requestedDate)}`,
                              }),
                            'Earning recorded.'
                          )
                        }
                      >
                        Log {money(pay)} to {job.assignedEmployeeName}
                      </Button>
                    ) : null}
                    {earningLogged ? (
                      <span className="badge badge-info">Earning logged</span>
                    ) : null}
                  </div>
                </AdminJobCard>
              );
            })
          )}
        </>
      ) : null}

      {/* ======================================================= EMPLOYEES === */}
      {tab === 'employees' ? (
        <>
          <InfoBanner>
            An employee signs up like any customer, then you approve them here.
            Nobody can make themselves an employee, and admin can only be
            granted by hand in the Firebase Console.
          </InfoBanner>

          <SectionHeading>Approved mowers</SectionHeading>
          {data.employees.filter((employee) => employee.approved).length === 0 ? (
            <EmptyState title="No approved mowers yet" />
          ) : (
            data.employees
              .filter((employee) => employee.approved)
              .map((employee) => (
                <Card key={employee.uid}>
                  <div className="job-card-head">
                    <div>
                      <p className="job-address">{employee.fullName}</p>
                      <p className="job-when">{employee.email}</p>
                    </div>
                    <span className="badge badge-good">Employee</span>
                  </div>
                  <div className="row">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        run(() => suspendEmployee(employee.uid), 'Access suspended.')
                      }
                    >
                      Suspend
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        run(() => removeEmployee(employee.uid), 'Removed from roster.')
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </Card>
              ))
          )}

          <SectionHeading>All accounts</SectionHeading>
          {data.users.map((account) => {
            const rosterEntry = data.employees.find(
              (employee) => employee.uid === account.id
            );
            const isApproved = rosterEntry?.approved === true;
            return (
              <Card key={account.id}>
                <div className="job-card-head">
                  <div>
                    <p className="job-address">{account.fullName}</p>
                    <p className="job-when">
                      {account.email} · {account.phone}
                    </p>
                  </div>
                  <span className={`badge badge-${isApproved ? 'good' : 'muted'}`}>
                    {isApproved ? 'employee' : account.role || 'customer'}
                  </span>
                </div>
                {!isApproved ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      run(
                        () =>
                          approveEmployee(account.id, {
                            fullName: account.fullName,
                            email: account.email,
                          }),
                        `${account.fullName} can now see available jobs.`
                      )
                    }
                  >
                    Approve as employee
                  </Button>
                ) : null}
              </Card>
            );
          })}
        </>
      ) : null}

      {/* ======================================================== PAYMENTS === */}
      {tab === 'payments' ? (
        <>
          <SectionHeading>Customer Payments</SectionHeading>
          <Card>
            <DetailRow label="Total billed" value={money(totals.revenue)} />
            <DetailRow label="Collected" value={money(totals.collected)} />
            <DetailRow
              label="Outstanding"
              value={money(totals.revenue - totals.collected)}
              strong
            />
          </Card>

          {completedJobs.length === 0 ? (
            <EmptyState title="No completed jobs to bill yet" />
          ) : (
            completedJobs.map((job) => {
              const bill = data.billingMap[job.id];
              const owner = data.users.find((candidate) => candidate.id === job.ownerId);
              return (
                <Card key={job.id}>
                  <div className="job-card-head">
                    <div>
                      <p className="job-address">{owner?.fullName || job.customerName}</p>
                      <p className="job-when">
                        {job.address} · {prettyDate(job.requestedDate)}
                      </p>
                    </div>
                    <span
                      className={`badge badge-${
                        bill?.paymentStatus === PAYMENT_STATUS.PAID ? 'good' : 'warn'
                      }`}
                    >
                      {bill?.paymentStatus === PAYMENT_STATUS.PAID ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                  <DetailRow label="Customer price" value={money(bill?.customerPrice)} />
                  <DetailRow label="Employee pay" value={money(data.payMap[job.id])} />
                  <DetailRow
                    label="Profit"
                    value={money(
                      Number(bill?.customerPrice || 0) - Number(data.payMap[job.id] || 0)
                    )}
                    strong
                  />
                  {bill?.paymentStatus !== PAYMENT_STATUS.PAID ? (
                    <Button
                      full
                      size="sm"
                      onClick={() => run(() => markJobPaid(job.id), 'Marked as paid.')}
                    >
                      Mark paid
                    </Button>
                  ) : null}
                </Card>
              );
            })
          )}
        </>
      ) : null}

      {/* ======================================================== EARNINGS === */}
      {tab === 'earnings' ? (
        <>
          <SectionHeading>Employee Earnings</SectionHeading>
          <InfoBanner>
            Version 1 does not pay mowers automatically. This is the running
            tally so you can pay them however you like, then mark it off.
          </InfoBanner>

          {data.earnings.length === 0 ? (
            <EmptyState
              title="No earnings logged yet"
              message="Log an earning from a completed job on the Jobs tab."
            />
          ) : (
            summarizeByEmployee(data.earnings).map((summary) => (
              <Card key={summary.employeeId}>
                <h3>{summary.employeeName}</h3>
                {summary.lines.map((line) => (
                  <div key={line.id} className="detail-row">
                    <span className="detail-label">
                      {line.jobLabel} {line.status === 'paid' ? '· paid' : ''}
                    </span>
                    <span className="detail-value">
                      {money(line.amount)}
                      {line.status !== 'paid' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          style={{ marginLeft: 8 }}
                          onClick={() =>
                            run(() => markEarningPaid(line.id), 'Marked as paid out.')
                          }
                        >
                          Pay
                        </Button>
                      ) : null}
                    </span>
                  </div>
                ))}
                <div className="total-row">
                  <span>Amount owed</span>
                  <span>{money(summary.owed)}</span>
                </div>
              </Card>
            ))
          )}
        </>
      ) : null}
    </Page>
  );
}

/* -------------------------------------------------------------------------- */
/* Small pieces used only by this screen                                       */
/* -------------------------------------------------------------------------- */

/** A dollar input plus a save button. Used for both prices. */
function PriceForm({ label, buttonLabel = 'Save', initial, onSubmit }) {
  const [value, setValue] = useState(initial != null ? String(initial) : '');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      return setProblem('Enter an amount greater than zero.');
    }
    setProblem('');
    setBusy(true);
    try {
      await onSubmit(amount);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 10 }}>
      <Field label={label} error={problem}>
        <div className="row">
          <TextInput
            type="number"
            inputMode="decimal"
            min="1"
            step="1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="42"
            error={problem}
          />
          <Button type="submit" loading={busy} style={{ flex: '0 0 auto' }}>
            {buttonLabel}
          </Button>
        </div>
      </Field>
    </form>
  );
}

/** One consultation with its actions. */
function ConsultationCard({ consultation, property, onStatus, onApprove }) {
  return (
    <Card>
      <div className="job-card-head">
        <div>
          <p className="job-address">{consultation.fullName}</p>
          <p className="job-when">{consultation.address}</p>
        </div>
        <StatusBadge status={consultation.status} kind="consultation" />
      </div>

      <DetailRow label="Phone" value={<a href={`tel:${consultation.phone}`}>{consultation.phone}</a>} />
      <DetailRow label="Email" value={consultation.email} />
      <DetailRow
        label="Preferred"
        value={`${prettyDate(consultation.preferredDate)}, ${prettyWindow(
          consultation.preferredTimeStart,
          consultation.preferredTimeEnd
        )}`}
      />

      {consultation.notes ? (
        <div className="note-block">
          <span className="note-label">Customer note</span>
          {consultation.notes}
        </div>
      ) : null}
      {property?.permanentNotes ? (
        <div className="note-block">
          <span className="note-label">Permanent property notes</span>
          {property.permanentNotes}
        </div>
      ) : null}

      <div className="row" style={{ marginTop: 10 }}>
        {consultation.status === CONSULTATION_STATUS.REQUESTED ? (
          <Button size="sm" variant="secondary" onClick={() => onStatus(CONSULTATION_STATUS.SCHEDULED)}>
            Mark scheduled
          </Button>
        ) : null}
        {consultation.status === CONSULTATION_STATUS.SCHEDULED ? (
          <Button size="sm" variant="secondary" onClick={() => onStatus(CONSULTATION_STATUS.COMPLETED)}>
            Mark inspected
          </Button>
        ) : null}
      </div>

      {consultation.status !== CONSULTATION_STATUS.APPROVED ? (
        <PriceForm
          label="Approve property & set price per mow"
          buttonLabel="APPROVE"
          initial={property?.customerPrice}
          onSubmit={onApprove}
        />
      ) : (
        <p className="small muted" style={{ marginTop: 8 }}>
          Approved at {money(property?.customerPrice)} per mow. The customer can
          now request mowing.
        </p>
      )}
    </Card>
  );
}

/** One job row for admin, showing BOTH money values. */
function AdminJobCard({ job, customerPrice, employeePay, children }) {
  return (
    <Card>
      <div className="job-card-head">
        <div>
          <p className="job-address">{job.address}</p>
          <p className="job-when">
            {job.customerName} · {prettyDate(job.requestedDate)},{' '}
            {prettyWindow(job.timeStart, job.timeEnd)}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <DetailRow label="Customer price" value={money(customerPrice)} />
      <DetailRow label="Employee pay" value={money(employeePay)} />
      <DetailRow
        label="Profit"
        value={money(Number(customerPrice || 0) - Number(employeePay || 0))}
        strong
      />
      {job.assignedEmployeeName ? (
        <DetailRow label="Accepted by" value={job.assignedEmployeeName} />
      ) : null}

      {job.temporaryNotes ? (
        <div className="note-block">
          <span className="note-label">Notes for this mow</span>
          {job.temporaryNotes}
        </div>
      ) : null}

      {children}

      <Link to={`/admin/job/${job.id}`} className="btn btn-ghost btn-full btn-sm" style={{ marginTop: 8 }}>
        Manage job
      </Link>
    </Card>
  );
}
