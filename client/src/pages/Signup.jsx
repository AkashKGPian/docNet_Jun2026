import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, Phone, UserCircle, Droplet, Hash, MapPin, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/common/BrandMark';
import '../styles/auth.css';

const Signup = () => {
  const navigate = useNavigate();
  const { checkCurrentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    age: '',
    gender: 'M',
    bloodGroup: 'Unknown',
    allergies: '',
    address: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password || !formData.phone) {
      toast.error('Please fill in all required fields.');
      return;
    }

    try {
      setIsLoading(true);
      const payload = { ...formData, age: Number(formData.age) || 0 };

      await api.post('/auth/patient/signup', payload);
      await checkCurrentUser();
      toast.success('Welcome to DocNet');
      navigate('/patient', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <aside className="auth-brand-panel">
        <BrandMark light />
        <div className="auth-brand-copy">
          <h2>Your health records, organized from day one.</h2>
          <p>
            Create a patient account to join hospital queues, receive token alerts,
            and access digital prescriptions after your visit.
          </p>
        </div>
      </aside>

      <main className="auth-form-panel">
        <div className="auth-card auth-card--wide">
          <div className="auth-header">
            <h1>Create account</h1>
            <p>Register as a patient — doctors and staff are added by hospitals.</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="signup-grid">
              <div className="auth-input-group col-span-2">
                <label>Full name</label>
                <div className="auth-input-wrapper">
                  <User className="auth-input-icon" size={18} />
                  <input type="text" name="name" value={formData.name} onChange={handleChange} className="auth-input-field" placeholder="John Doe" required />
                </div>
              </div>

              <div className="auth-input-group">
                <label>Email</label>
                <div className="auth-input-wrapper">
                  <Mail className="auth-input-icon" size={18} />
                  <input type="email" name="email" value={formData.email} onChange={handleChange} className="auth-input-field" placeholder="john@example.com" required />
                </div>
              </div>

              <div className="auth-input-group">
                <label>Password</label>
                <div className="auth-input-wrapper">
                  <Lock className="auth-input-icon" size={18} />
                  <input type="password" name="password" value={formData.password} onChange={handleChange} className="auth-input-field" placeholder="Min 6 characters" minLength="6" required />
                </div>
              </div>

              <div className="auth-input-group">
                <label>Phone</label>
                <div className="auth-input-wrapper">
                  <Phone className="auth-input-icon" size={18} />
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="auth-input-field" placeholder="+91 9876543210" required />
                </div>
              </div>

              <div className="auth-input-group">
                <label>Age</label>
                <div className="auth-input-wrapper">
                  <Hash className="auth-input-icon" size={18} />
                  <input type="number" name="age" value={formData.age} onChange={handleChange} className="auth-input-field" placeholder="34" min="0" max="150" />
                </div>
              </div>

              <div className="auth-input-group">
                <label>Gender</label>
                <div className="auth-input-wrapper">
                  <UserCircle className="auth-input-icon" size={18} />
                  <select name="gender" value={formData.gender} onChange={handleChange} className="auth-input-field">
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="O">Other</option>
                  </select>
                </div>
              </div>

              <div className="auth-input-group">
                <label>Blood group</label>
                <div className="auth-input-wrapper">
                  <Droplet className="auth-input-icon" size={18} />
                  <select name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} className="auth-input-field">
                    <option value="Unknown">Unknown</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              <div className="auth-input-group col-span-2">
                <label>Address</label>
                <div className="auth-input-wrapper">
                  <MapPin className="auth-input-icon" size={18} />
                  <input type="text" name="address" value={formData.address} onChange={handleChange} className="auth-input-field" placeholder="123 Main St, City" />
                </div>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="btn btn-primary w-full" style={{ marginTop: '1.25rem', height: '2.75rem' }}>
              {isLoading ? 'Creating account…' : (
                <span className="flex items-center justify-center gap-2">
                  Register as patient <ArrowRight size={18} />
                </span>
              )}
            </button>
          </form>

          <p className="auth-footer">
            Already registered? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Signup;
