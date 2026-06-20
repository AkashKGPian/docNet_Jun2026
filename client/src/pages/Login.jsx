import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Stethoscope, Building2, Lock, Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/common/BrandMark';
import SiteFooter from '../components/common/SiteFooter';
import PasswordField from '../components/common/PasswordField';
import toast from 'react-hot-toast';
import '../styles/auth.css';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeRole, setActiveRole] = useState('PATIENT');
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);

  const roles = [
    { id: 'PATIENT', label: 'Patient', icon: User },
    { id: 'DOCTOR', label: 'Doctor', icon: Stethoscope },
    { id: 'STAFF', label: 'Staff', icon: Building2 },
  ];

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      toast.error('Please enter both email and password.');
      return;
    }

    try {
      setIsLoading(true);
      await login(formData.email, formData.password, activeRole);
      toast.success('Welcome back');

      const redirectPath =
        location.state?.from?.pathname && location.state.from.pathname !== '/'
          ? location.state.from.pathname
          : `/${activeRole.toLowerCase()}`;

      navigate(redirectPath, { replace: true });
    } catch (error) {
      const message = error.response?.data?.error;
      if (message?.includes('staff or doctor login portal')) {
        toast.error('This account is Staff — select the Staff tab above, then sign in again.');
      } else if (message?.includes('CSRF')) {
        toast.error('Session security token expired. Refresh the page and try again.');
      } else if (message?.includes('Too many requests')) {
        toast.error('Too many API requests — wait a minute or restart the server, then retry.');
      } else {
        toast.error(message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <aside className="auth-brand-panel">
          <BrandMark light />

          <div className="auth-brand-copy">
            <h2>Hospital queues and prescriptions, in one calm place.</h2>
            <p>
              Join a doctor&apos;s line, track your token, and receive digital prescriptions —
              without the waiting-room chaos.
            </p>

            <div className="auth-brand-stats">
              <div className="auth-stat">
                <strong>Live</strong>
                <span>Queue updates</span>
              </div>
              <div className="auth-stat">
                <strong>Secure</strong>
                <span>Role-based access</span>
              </div>
              <div className="auth-stat">
                <strong>Digital</strong>
                <span>Prescriptions</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="auth-form-panel">
          <div className="auth-card">
            <div className="auth-header">
              <h1>Sign in</h1>
              <p>Choose your portal and enter your credentials.</p>
            </div>

            <div className="role-tabs">
              {roles.map((role) => {
                const Icon = role.icon;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setActiveRole(role.id)}
                    className={`role-tab ${activeRole === role.id ? 'active' : ''}`}
                  >
                    <Icon size={18} />
                    {role.label}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="input-group">
                <label htmlFor="email">Email</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={18} />
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder={`${activeRole.toLowerCase()}@example.com`}
                    required
                  />
                </div>
              </div>

            <div className="input-group">
              <label htmlFor="password">Password</label>
              <PasswordField
                id="password"
                name="password"
                icon={<Lock className="input-icon" size={18} />}
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
            </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary w-full"
                style={{ marginTop: '0.5rem', height: '2.75rem', position: 'relative' }}
              >
                <span style={{ opacity: isLoading ? 0 : 1, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  Sign in as {activeRole === 'STAFF' ? 'Staff' : activeRole.charAt(0) + activeRole.slice(1).toLowerCase()}
                  <ArrowRight size={18} />
                </span>
                {isLoading && (
                  <div className="spinner-overlay">
                    <div className="spinner" />
                  </div>
                )}
              </button>
            </form>

            {activeRole === 'STAFF' && (
              <p className="auth-role-hint">
                Hospital admin accounts (e.g. <strong>admin@docnet.com</strong>) must use the Staff tab.
              </p>
            )}

            {activeRole === 'PATIENT' && (
              <p className="auth-footer">
                New here?{' '}
                <button type="button" onClick={() => navigate('/signup')}>
                  Create a patient account
                </button>
              </p>
            )}
          </div>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
};

export default Login;
