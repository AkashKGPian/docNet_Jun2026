import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  LogOut,
  Shield,
  UserPlus,
  Stethoscope,
  RefreshCw,
  CheckCircle2,
  Users,
  MapPin,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import BrandMark from '../../components/common/BrandMark';
import api from '../../utils/api';
import './PlatformAdminDashboard.css';

const DEFAULT_DEPARTMENTS = 'General Medicine, Cardiology, Orthopedics, Pediatrics';

const EMPTY_HOSPITAL_FORM = {
  hospitalName: '',
  staffEmail: '',
  staffName: 'Hospital Admin',
  staffPassword: 'password123',
  staffPhone: '9876543210',
  address: '',
  departments: DEFAULT_DEPARTMENTS,
  hasDispensary: true,
};

const EMPTY_DOCTOR_FORM = {
  name: 'Dr. Demo',
  email: '',
  password: 'password123',
  phone: '9868543210',
  department: 'General Medicine',
  specialization: 'General Physician',
  dailyPatientLimit: 50,
};

const PlatformAdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activePanel, setActivePanel] = useState('overview');
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hospitalForm, setHospitalForm] = useState(EMPTY_HOSPITAL_FORM);
  const [doctorForm, setDoctorForm] = useState(EMPTY_DOCTOR_FORM);
  const [selectedHospitalId, setSelectedHospitalId] = useState('');
  const [creatingHospital, setCreatingHospital] = useState(false);
  const [creatingDoctor, setCreatingDoctor] = useState(false);
  const [lastCreated, setLastCreated] = useState(null);

  const fetchHospitals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/platform/hospitals');
      const list = res.data?.hospitals || [];
      setHospitals(list);
      if (!selectedHospitalId && list.length) {
        setSelectedHospitalId(list[0]._id);
        setDoctorForm((prev) => ({
          ...prev,
          department: list[0].departments?.[0] || 'General Medicine',
        }));
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not load hospitals.');
    } finally {
      setLoading(false);
    }
  }, [selectedHospitalId]);

  useEffect(() => {
    fetchHospitals();
  }, [fetchHospitals]);

  const selectedHospital = hospitals.find((h) => h._id === selectedHospitalId);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const updateHospitalField = (field, value) => {
    setHospitalForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateDoctorField = (field, value) => {
    setDoctorForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleHospitalSelect = (storeId) => {
    setSelectedHospitalId(storeId);
    const hospital = hospitals.find((h) => h._id === storeId);
    if (hospital?.departments?.length) {
      setDoctorForm((prev) => ({
        ...prev,
        department: hospital.departments.includes(prev.department)
          ? prev.department
          : hospital.departments[0],
      }));
    }
  };

  const handleCreateHospital = async (event) => {
    event.preventDefault();
    if (!hospitalForm.hospitalName.trim() || !hospitalForm.staffEmail.trim()) {
      toast.error('Hospital name and staff email are required.');
      return;
    }

    try {
      setCreatingHospital(true);
      const res = await api.post('/platform/hospitals', {
        ...hospitalForm,
        departments: hospitalForm.departments
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean),
      });

      toast.success(res.data?.message || 'Hospital provisioned.');
      setLastCreated({
        type: 'hospital',
        hospital: res.data.store?.name,
        email: res.data.credentials?.email || hospitalForm.staffEmail,
        password: hospitalForm.staffPassword,
      });
      setHospitalForm(EMPTY_HOSPITAL_FORM);
      await fetchHospitals();
      setActivePanel('overview');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create hospital.');
    } finally {
      setCreatingHospital(false);
    }
  };

  const handleCreateDoctor = async (event) => {
    event.preventDefault();
    if (!selectedHospitalId) {
      toast.error('Select a hospital first.');
      return;
    }
    if (!doctorForm.name.trim() || !doctorForm.email.trim() || !doctorForm.password.trim()) {
      toast.error('Doctor name, email, and password are required.');
      return;
    }

    try {
      setCreatingDoctor(true);
      const res = await api.post(`/platform/hospitals/${selectedHospitalId}/doctors`, doctorForm);

      toast.success(res.data?.message || 'Doctor created.');
      setLastCreated({
        type: 'doctor',
        hospital: res.data.hospital?.name || selectedHospital?.name,
        email: res.data.credentials?.email || doctorForm.email,
        password: doctorForm.password,
        doctorName: doctorForm.name,
      });
      setDoctorForm((prev) => ({ ...EMPTY_DOCTOR_FORM, department: prev.department }));
      await fetchHospitals();
    } catch (error) {
      if (error.response?.data?.existing) {
        toast.error('Doctor email already exists — use a different email.');
      } else {
        toast.error(error.response?.data?.error || 'Failed to create doctor.');
      }
    } finally {
      setCreatingDoctor(false);
    }
  };

  const totalDoctors = hospitals.reduce((sum, h) => sum + (h.doctorCount || 0), 0);
  const totalStaff = hospitals.reduce((sum, h) => sum + (h.staffCount || 0), 0);

  return (
    <div className="platform-shell">
      <aside className="platform-sidebar">
        <div className="platform-sidebar__brand">
          <BrandMark compact />
          <span className="platform-badge">
            <Shield size={14} />
            Platform Admin
          </span>
        </div>

        <nav className="platform-nav">
          <button
            type="button"
            className={`platform-nav__item ${activePanel === 'overview' ? 'active' : ''}`}
            onClick={() => setActivePanel('overview')}
          >
            <Building2 size={18} />
            All Hospitals
          </button>
          <button
            type="button"
            className={`platform-nav__item ${activePanel === 'hospital' ? 'active' : ''}`}
            onClick={() => setActivePanel('hospital')}
          >
            <UserPlus size={18} />
            New Hospital
          </button>
          <button
            type="button"
            className={`platform-nav__item ${activePanel === 'doctor' ? 'active' : ''}`}
            onClick={() => setActivePanel('doctor')}
          >
            <Stethoscope size={18} />
            Add Doctor
          </button>
        </nav>

        <div className="platform-sidebar__footer">
          <div className="platform-user">
            <div className="platform-user__avatar">
              {(user?.name || 'A').charAt(0)}
            </div>
            <div>
              <strong>{user?.name}</strong>
              <span>{user?.email}</span>
            </div>
          </div>
          <button type="button" className="platform-logout" onClick={handleLogout}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="platform-main">
        <header className="platform-header">
          <div>
            <h1>Production Hospital Control</h1>
            <p>Provision hospitals, staff logins, and doctors — same as the EC2 terminal scripts.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={fetchHospitals} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </header>

        {lastCreated && (
          <div className="platform-success-banner">
            <CheckCircle2 size={20} />
            <div>
              {lastCreated.type === 'hospital' ? (
                <>
                  <strong>{lastCreated.hospital}</strong> is ready. Staff login:{' '}
                  <code>{lastCreated.email}</code> / <code>{lastCreated.password}</code>
                </>
              ) : (
                <>
                  <strong>{lastCreated.doctorName}</strong> added to {lastCreated.hospital}. Login:{' '}
                  <code>{lastCreated.email}</code> / <code>{lastCreated.password}</code>
                </>
              )}
            </div>
            <button type="button" onClick={() => setLastCreated(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        <section className="platform-stats">
          <article className="platform-stat-card">
            <Building2 size={22} />
            <div>
              <strong>{hospitals.length}</strong>
              <span>Hospitals</span>
            </div>
          </article>
          <article className="platform-stat-card">
            <Users size={22} />
            <div>
              <strong>{totalStaff}</strong>
              <span>Staff accounts</span>
            </div>
          </article>
          <article className="platform-stat-card">
            <Stethoscope size={22} />
            <div>
              <strong>{totalDoctors}</strong>
              <span>Doctors</span>
            </div>
          </article>
        </section>

        {activePanel === 'overview' && (
          <section className="platform-panel">
            <div className="platform-panel__head">
              <h2>Registered hospitals</h2>
              <button type="button" className="btn btn-primary" onClick={() => setActivePanel('hospital')}>
                <Sparkles size={16} />
                Provision hospital
              </button>
            </div>

            {loading ? (
              <div className="platform-loading">
                <div className="spinner" />
                <p>Loading hospitals…</p>
              </div>
            ) : hospitals.length === 0 ? (
              <div className="platform-empty">
                <Building2 size={40} />
                <h3>No hospitals yet</h3>
                <p>Create your first hospital and staff account to get started.</p>
                <button type="button" className="btn btn-primary" onClick={() => setActivePanel('hospital')}>
                  Create hospital
                </button>
              </div>
            ) : (
              <div className="platform-hospital-grid">
                {hospitals.map((hospital) => (
                  <article key={hospital._id} className="platform-hospital-card">
                    <div className="platform-hospital-card__head">
                      <h3>{hospital.name}</h3>
                      <span className={`platform-pill ${hospital.isActive ? 'active' : 'inactive'}`}>
                        {hospital.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </div>
                    {hospital.address && (
                      <p className="platform-hospital-card__address">
                        <MapPin size={14} />
                        {hospital.address}
                      </p>
                    )}
                    <div className="platform-hospital-card__meta">
                      <span>{hospital.staffCount} staff</span>
                      <span>{hospital.doctorCount} doctors</span>
                      <span>{hospital.departments?.length || 0} depts</span>
                    </div>
                    {hospital.staff?.[0] && (
                      <p className="platform-hospital-card__staff">
                        Staff: {hospital.staff[0].email}
                      </p>
                    )}
                    <div className="platform-hospital-card__actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          handleHospitalSelect(hospital._id);
                          setActivePanel('doctor');
                        }}
                      >
                        Add doctor
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activePanel === 'hospital' && (
          <section className="platform-panel platform-form-panel">
            <div className="platform-panel__head">
              <h2>New hospital + staff</h2>
              <p>Equivalent to <code>createHospitalStaff.js</code> on EC2.</p>
            </div>

            <form className="platform-form" onSubmit={handleCreateHospital}>
              <div className="platform-form-grid">
                <div className="input-group span-2">
                  <label htmlFor="hospitalName">Hospital name *</label>
                  <input
                    id="hospitalName"
                    className="input-field"
                    value={hospitalForm.hospitalName}
                    onChange={(e) => updateHospitalField('hospitalName', e.target.value)}
                    placeholder="Apollo City Hospital"
                    required
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="staffEmail">Staff email *</label>
                  <input
                    id="staffEmail"
                    type="email"
                    className="input-field"
                    value={hospitalForm.staffEmail}
                    onChange={(e) => updateHospitalField('staffEmail', e.target.value)}
                    placeholder="apollo.admin@docnet.com"
                    required
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="staffName">Staff display name</label>
                  <input
                    id="staffName"
                    className="input-field"
                    value={hospitalForm.staffName}
                    onChange={(e) => updateHospitalField('staffName', e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="staffPassword">Staff password</label>
                  <input
                    id="staffPassword"
                    type="text"
                    className="input-field"
                    value={hospitalForm.staffPassword}
                    onChange={(e) => updateHospitalField('staffPassword', e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="staffPhone">Staff phone</label>
                  <input
                    id="staffPhone"
                    className="input-field"
                    value={hospitalForm.staffPhone}
                    onChange={(e) => updateHospitalField('staffPhone', e.target.value)}
                  />
                </div>

                <div className="input-group span-2">
                  <label htmlFor="address">Address</label>
                  <input
                    id="address"
                    className="input-field"
                    value={hospitalForm.address}
                    onChange={(e) => updateHospitalField('address', e.target.value)}
                    placeholder="123 Main St, City"
                  />
                </div>

                <div className="input-group span-2">
                  <label htmlFor="departments">Departments (comma-separated)</label>
                  <input
                    id="departments"
                    className="input-field"
                    value={hospitalForm.departments}
                    onChange={(e) => updateHospitalField('departments', e.target.value)}
                  />
                </div>

                <label className="platform-checkbox span-2">
                  <input
                    type="checkbox"
                    checked={hospitalForm.hasDispensary}
                    onChange={(e) => updateHospitalField('hasDispensary', e.target.checked)}
                  />
                  Hospital has in-house dispensary
                </label>
              </div>

              <div className="platform-form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setActivePanel('overview')}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creatingHospital}>
                  {creatingHospital ? 'Creating…' : 'Create hospital & staff'}
                </button>
              </div>
            </form>
          </section>
        )}

        {activePanel === 'doctor' && (
          <section className="platform-panel platform-form-panel">
            <div className="platform-panel__head">
              <h2>Add doctor to hospital</h2>
              <p>Equivalent to <code>createDoctorForHospital.js</code> on EC2.</p>
            </div>

            {hospitals.length === 0 ? (
              <div className="platform-empty inline">
                <p>Create a hospital first, then add doctors here.</p>
                <button type="button" className="btn btn-primary" onClick={() => setActivePanel('hospital')}>
                  Create hospital
                </button>
              </div>
            ) : (
              <form className="platform-form" onSubmit={handleCreateDoctor}>
                <div className="platform-form-grid">
                  <div className="input-group span-2">
                    <label htmlFor="hospitalSelect">Hospital *</label>
                    <select
                      id="hospitalSelect"
                      className="input-field"
                      value={selectedHospitalId}
                      onChange={(e) => handleHospitalSelect(e.target.value)}
                    >
                      {hospitals.map((h) => (
                        <option key={h._id} value={h._id}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group">
                    <label htmlFor="doctorName">Doctor name *</label>
                    <input
                      id="doctorName"
                      className="input-field"
                      value={doctorForm.name}
                      onChange={(e) => updateDoctorField('name', e.target.value)}
                      placeholder="Dr. Sharma"
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="doctorEmail">Doctor email *</label>
                    <input
                      id="doctorEmail"
                      type="email"
                      className="input-field"
                      value={doctorForm.email}
                      onChange={(e) => updateDoctorField('email', e.target.value)}
                      placeholder="doctor@apollo.com"
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="doctorPassword">Password *</label>
                    <input
                      id="doctorPassword"
                      type="text"
                      className="input-field"
                      value={doctorForm.password}
                      onChange={(e) => updateDoctorField('password', e.target.value)}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="doctorPhone">Phone</label>
                    <input
                      id="doctorPhone"
                      className="input-field"
                      value={doctorForm.phone}
                      onChange={(e) => updateDoctorField('phone', e.target.value)}
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="doctorDepartment">Department *</label>
                    {selectedHospital?.departments?.length ? (
                      <select
                        id="doctorDepartment"
                        className="input-field"
                        value={doctorForm.department}
                        onChange={(e) => updateDoctorField('department', e.target.value)}
                      >
                        {selectedHospital.departments.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id="doctorDepartment"
                        className="input-field"
                        value={doctorForm.department}
                        onChange={(e) => updateDoctorField('department', e.target.value)}
                      />
                    )}
                  </div>

                  <div className="input-group">
                    <label htmlFor="specialization">Specialization</label>
                    <input
                      id="specialization"
                      className="input-field"
                      value={doctorForm.specialization}
                      onChange={(e) => updateDoctorField('specialization', e.target.value)}
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="dailyLimit">Daily patient limit</label>
                    <input
                      id="dailyLimit"
                      type="number"
                      min="1"
                      className="input-field"
                      value={doctorForm.dailyPatientLimit}
                      onChange={(e) => updateDoctorField('dailyPatientLimit', Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="platform-form-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setActivePanel('overview')}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={creatingDoctor}>
                    {creatingDoctor ? 'Creating…' : 'Create doctor'}
                  </button>
                </div>
              </form>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

export default PlatformAdminDashboard;
