// =============================================================================
// App.jsx — every page in the site, in one list.
// =============================================================================
// Start here when you are looking for a screen. Each route points at a file in
// src/pages/. Public pages are first, then customer, employee and admin.
// =============================================================================

import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { ROLES } from './lib/constants';

// Public
import Home from './pages/Home';
import Go from './pages/Go';
import HowItWorks from './pages/HowItWorks';
import Contact from './pages/Contact';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import NotFound from './pages/NotFound';

// Customer
import CustomerDashboard from './pages/customer/Dashboard';
import RequestConsultation from './pages/customer/RequestConsultation';
import RequestMow from './pages/customer/RequestMow';
import MyAccount from './pages/customer/MyAccount';

// Employee
import EmployeeDashboard from './pages/employee/Dashboard';
import EmployeeJobDetail from './pages/employee/JobDetail';

// Admin
import AdminDashboard from './pages/admin/Dashboard';
import AdminCustomerDetail from './pages/admin/CustomerDetail';
import AdminJobDetail from './pages/admin/JobDetail';

export default function App() {
  return (
    <Routes>
      {/* ---------------------------------------------------------- public */}
      <Route path="/" element={<Home />} />
      {/* The permanent QR-code destination. Change what this does later
          WITHOUT reprinting a single door hanger — see src/pages/Go.jsx. */}
      <Route path="/go" element={<Go />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />

      {/* -------------------------------------------------------- customer */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allow={[ROLES.CUSTOMER]}>
            <CustomerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/request-consultation"
        element={
          <ProtectedRoute allow={[ROLES.CUSTOMER]}>
            <RequestConsultation />
          </ProtectedRoute>
        }
      />
      <Route
        path="/request-mow"
        element={
          <ProtectedRoute allow={[ROLES.CUSTOMER]}>
            <RequestMow />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <MyAccount />
          </ProtectedRoute>
        }
      />

      {/* -------------------------------------------------------- employee */}
      <Route
        path="/employee"
        element={
          <ProtectedRoute allow={[ROLES.EMPLOYEE]}>
            <EmployeeDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employee/job/:jobId"
        element={
          <ProtectedRoute allow={[ROLES.EMPLOYEE]}>
            <EmployeeJobDetail />
          </ProtectedRoute>
        }
      />

      {/* ----------------------------------------------------------- admin */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allow={[ROLES.ADMIN]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/customer/:userId"
        element={
          <ProtectedRoute allow={[ROLES.ADMIN]}>
            <AdminCustomerDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/job/:jobId"
        element={
          <ProtectedRoute allow={[ROLES.ADMIN]}>
            <AdminJobDetail />
          </ProtectedRoute>
        }
      />

      <Route path="/index.html" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
