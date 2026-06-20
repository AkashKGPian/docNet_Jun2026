import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import BrandMark from '../../components/common/BrandMark';
import SiteFooter from '../../components/common/SiteFooter';
import toast from 'react-hot-toast';
import '../../styles/auth.css';
import './PlatformLogin.css';

const PlatformLogin = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);

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
      await login(formData.email, formData.password, 'PLATFORM_ADMIN');
      toast.success('Welcome, platform admin');

      const redirectPath =
        location.state?.from?.pathname && location.state.from.pathname !== '/'
          ? location.state.from.pathname
          : '/platform';

      navigate(redirectPath, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="platform-login-shell">
        <aside className="platform-login-brand">
          <BrandMark light />
          <div className="platform-login-brand__copy">
            <div className="platform-login-workspace">
              <div className="platform-login-workspace__icon">
                <Shield size={18} strokeWidth={2.25} />
              </div>
              <div>
                <strong>Platform Admin</strong>
                <span>Production control</span>
              </div>
            </div>
            <h2>Production hospital control</h2>
            <p>
              Provision hospitals, staff accounts, and doctors across the entire DocNet deployment.
            </p>
          </div>
        </aside>

        <main className="auth-form-panel">
          <div className="auth-card">
            <Link to="/login" className="platform-login-back">
              <ArrowLeft size={16} />
              Back to main sign in
            </Link>

            <div className="auth-header">
              <h1>Platform sign in</h1>
              <p>Restricted access for DocNet administrators only.</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="input-group">
                <label htmlFor="email">Admin email</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={18} />
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder="platform@docnet.com"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="password">Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={18} />
                  <input
                    id="password"
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder="Enter password"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary w-full platform-login-submit"
              >
                <span style={{ opacity: isLoading ? 0 : 1, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  Sign in to platform
                  <ArrowRight size={18} />
                </span>
                {isLoading && (
                  <div className="spinner-overlay">
                    <div className="spinner" />
                  </div>
                )}
              </button>
            </form>

            <p className="auth-role-hint">
              Accounts are created via <strong>createPlatformAdmin.js</strong> on the server — not self-service.
            </p>
          </div>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
};

export default PlatformLogin;
