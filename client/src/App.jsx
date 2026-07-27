import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login from './pages/Login';
import ProtectedRoute from './components/common/ProtectedRoute';
import Signup from './pages/Signup';
import PatientDashboard from './pages/patient/PatientDashboard';
import HospitalSearch from './pages/patient/HospitalSearch';
import HospitalView from './pages/patient/HospitalView';
import DoctorDashboard from './pages/doctor/DoctorDashboard';
const Canvas = React.lazy(() => import('./pages/doctor/Canvas'));
import StaffDashboard from './pages/staff/StaffDashboard';
import PlatformAdminDashboard from './pages/platform/PlatformAdminDashboard';
import PlatformLogin from './pages/platform/PlatformLogin';
import PrescriptionView from './pages/patient/PrescriptionView';
import PrescriptionHistory from './pages/patient/PrescriptionHistory';
import PatientProfileEdit from './pages/patient/PatientProfileEdit';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
          {/* Global Toast Notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--surface-raised)',
                color: 'var(--ink)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-md)',
                fontFamily: 'var(--font-sans)',
              },
            }}
          />
          
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/platform/login" element={<PlatformLogin />} />
          
          <Route path="/patient" element={
            <ProtectedRoute allowedRoles={['PATIENT']}>
              <PatientDashboard />
            </ProtectedRoute>
          } />

          <Route path="/search" element={
            <ProtectedRoute allowedRoles={['PATIENT']}>
              <HospitalSearch />
            </ProtectedRoute>
          } />

          <Route path="/hospital/:id" element={
            <ProtectedRoute allowedRoles={['PATIENT']}>
              <HospitalView />
            </ProtectedRoute>
          } />

          <Route path="/patient/profile" element={
            <ProtectedRoute allowedRoles={['PATIENT']}>
              <PatientProfileEdit />
            </ProtectedRoute>
          } />

          <Route path="/prescriptions" element={
            <ProtectedRoute allowedRoles={['PATIENT']}>
              <PrescriptionHistory />
            </ProtectedRoute>
          } />

          <Route path="/prescription/:id" element={
            <ProtectedRoute allowedRoles={['PATIENT', 'DOCTOR']}>
              <PrescriptionView />
            </ProtectedRoute>
          } />
          
          <Route path="/doctor" element={
            <ProtectedRoute allowedRoles={['DOCTOR']}>
              <DoctorDashboard />
            </ProtectedRoute>
          } />

          <Route path="/canvas/:tokenId" element={
            <ProtectedRoute allowedRoles={['DOCTOR']}>
              <Suspense fallback={
                <div className="auth-shell" style={{ gridTemplateColumns: '1fr' }}>
                  <div className="auth-form-panel">
                    <div className="auth-card" style={{ textAlign: 'center' }}>
                      <div className="spinner" style={{ margin: '0 auto 1rem', borderColor: 'var(--brand-ring)', borderTopColor: 'var(--brand)' }} />
                      <p style={{ color: 'var(--ink-muted)', fontWeight: 600 }}>Loading canvas…</p>
                    </div>
                  </div>
                </div>
              }>
                <Canvas />
              </Suspense>
            </ProtectedRoute>
          } />
          
          <Route path="/staff" element={
            <ProtectedRoute allowedRoles={['STAFF']}>
              <StaffDashboard />
            </ProtectedRoute>
          } />

          <Route path="/platform" element={
            <ProtectedRoute allowedRoles={['PLATFORM_ADMIN']}>
              <PlatformAdminDashboard />
            </ProtectedRoute>
          } />
          
          {/* Default redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
