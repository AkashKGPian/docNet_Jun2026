import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Users,
  Calendar,
  LogOut,
  Search,
  Settings,
  UserPlus,
  Pencil,
  Trash2,
  Sparkles,
  Mail,
  Phone,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import BrandMark from '../../components/common/BrandMark';
import DoctorFormModal from '../../components/staff/DoctorFormModal';
import DepartmentManager from '../../components/staff/DepartmentManager';
import './StaffDashboard.css';

const StaffDashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('roster');
  const [hospital, setHospital] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    fetchStaffData();
  }, []);

  const fetchStaffData = async () => {
    try {
      setLoading(true);
      const [detailsRes, deptRes] = await Promise.all([
        api.get('/stores/staff/details'),
        api.get('/auth/staff/departments'),
      ]);

      if (detailsRes.data?.success) {
        setHospital(detailsRes.data.hospital);
        setDoctors(detailsRes.data.doctors);
        if (detailsRes.data.hospital?.departments) {
          setDepartments(detailsRes.data.hospital.departments);
        }
      }

      if (deptRes.data?.departments) {
        setDepartments(deptRes.data.departments);
      }
    } catch (error) {
      console.error('Failed to fetch staff portal data', error);
      toast.error('Could not load hospital data.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const openAddDoctor = () => {
    setEditingDoctor(null);
    setShowDoctorModal(true);
  };

  const openEditDoctor = (doctor) => {
    setEditingDoctor(doctor);
    setShowDoctorModal(true);
  };

  const handleDeleteDoctor = async (doctor) => {
    const name = doctor.userId?.name || 'this doctor';
    if (!window.confirm(`Remove ${name} from the roster? Their login will be deleted.`)) return;

    try {
      await api.delete(`/auth/staff/doctors/${doctor._id}`);
      toast.success('Doctor removed.');
      fetchStaffData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to remove doctor.');
    }
  };

  const handleSeedDemo = async () => {
    try {
      setSeeding(true);
      await api.post('/auth/staff/doctors/seed');
      toast.success('Demo doctor created (chavla@docnet.com / password123)');
      fetchStaffData();
    } catch (error) {
      if (error.response?.data?.existing) {
        toast.error('Demo doctor already exists — edit them from the roster.');
      } else {
        toast.error(error.response?.data?.error || 'Failed to run demo seed.');
      }
    } finally {
      setSeeding(false);
    }
  };

  const toggleDoctorAvailability = async (doctorId, currentStatus) => {
    const newStatus = currentStatus === 'ABSENT' ? 'AVAILABLE' : 'ABSENT';

    try {
      await api.patch(`/stores/staff/doctors/${doctorId}/availability`, {
        isAvailable: newStatus,
      });
      setDoctors(
        doctors.map((doctor) =>
          doctor._id === doctorId ? { ...doctor, isAvailable: newStatus } : doctor
        )
      );
      toast.success(
        newStatus === 'ABSENT'
          ? 'Doctor marked not at clinic today.'
          : 'Doctor marked present at the facility.'
      );
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update doctor availability.');
    }
  };

  const isAcceptingNewPatients = (doctor, todayQueue) => {
    if (doctor.isAvailable === 'ABSENT' || doctor.isAvailable === 'PAUSED') return false;
    if (todayQueue?.queueId && todayQueue.isPaused) return false;
    return true;
  };

  const toggleQueueAcceptance = async (doctor) => {
    if (doctor.isAvailable === 'ABSENT') {
      toast.error('Turn on physical presence first.');
      return;
    }

    const queueId = doctor.todayQueue?.queueId;
    const isQueuePaused = doctor.todayQueue?.isPaused;
    const currentlyAccepting = isAcceptingNewPatients(doctor, doctor.todayQueue);

    try {
      if (queueId) {
        await api.post(`/queue/${queueId}/status`, { isPaused: currentlyAccepting });
      }

      const nextDoctorStatus = currentlyAccepting ? 'PAUSED' : 'AVAILABLE';
      if (doctor.isAvailable !== nextDoctorStatus) {
        await api.patch(`/stores/staff/doctors/${doctor._id}/availability`, {
          isAvailable: nextDoctorStatus,
        });
      }

      toast.success(
        currentlyAccepting
          ? 'Queue closed — no new patients can join.'
          : 'Queue open — patients can join.'
      );
      fetchStaffData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update queue acceptance.');
    }
  };

  const filteredDoctors = doctors.filter((doctor) => {
    const name = doctor.userId?.name || '';
    const email = doctor.userId?.email || '';
    const specialization = doctor.specialization || '';
    const department = doctor.department || '';
    const haystack = `${name} ${email} ${specialization} ${department}`.toLowerCase();
    return haystack.includes(searchTerm.toLowerCase());
  });

  const navItems = [
    { id: 'roster', label: 'Doctor Roster', icon: Users },
    { id: 'departments', label: 'Departments', icon: Building2 },
  ];

  return (
    <div className="staff-dashboard-container">
      <div className="staff-sidebar">
        <BrandMark />
        <div style={{ height: '1.5rem' }} />

        <div className="flex flex-col gap-2 flex-1">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`staff-nav-item ${activeTab === id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={18} /> {label}
            </button>
          ))}
          <button type="button" className="staff-nav-item" disabled>
            <Calendar size={18} /> Master Schedule
          </button>
          <button type="button" className="staff-nav-item" disabled>
            <Settings size={18} /> Settings
          </button>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="staff-nav-item"
          style={{ marginTop: 'auto', color: 'var(--ink-subtle)' }}
        >
          <LogOut size={18} /> Exit Console
        </button>
      </div>

      <div className="staff-main">
        {loading ? (
          <div className="staff-loading">Loading console…</div>
        ) : (
          <>
            <div className="hospital-overview">
              <div className="overview-left">
                <h2>
                  <Building2 size={24} style={{ color: 'var(--brand)' }} /> {hospital?.name || 'Hospital'}
                </h2>
                <p className="overview-address">{hospital?.address || 'Address not listed'}</p>
                <div className="overview-badges">
                  {hospital?.isOpen ? (
                    <span className="badge badge-open">Facility open</span>
                  ) : (
                    <span className="badge badge-closed">Facility closed</span>
                  )}
                  <span className="badge" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                    {departments.length} departments
                  </span>
                </div>
              </div>
              <div className="overview-stats">
                <div className="overview-stat-value">{doctors.length}</div>
                <div className="overview-stat-label">Doctors on roster</div>
              </div>
            </div>

            {activeTab === 'roster' && (
              <>
                <div className="roster-toolbar">
                  <div>
                    <h3 className="roster-title">Doctor Roster & Queue Control</h3>
                    <p className="roster-subtitle">Add, edit, or remove doctors — replaces manual createDoctor.js runs.</p>
                  </div>
                  <div className="roster-toolbar__actions">
                    <div className="staff-search">
                      <Search size={16} />
                      <input
                        type="text"
                        placeholder="Search name, email, dept…"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                      />
                    </div>
                    <button type="button" className="btn btn-secondary" onClick={handleSeedDemo} disabled={seeding}>
                      <Sparkles size={16} /> {seeding ? 'Seeding…' : 'Run demo seed'}
                    </button>
                    <button type="button" className="btn btn-primary" onClick={openAddDoctor}>
                      <UserPlus size={16} /> Add doctor
                    </button>
                  </div>
                </div>

                {filteredDoctors.length === 0 ? (
                  <div className="empty-roster card">
                    <Users size={40} style={{ color: 'var(--ink-subtle)' }} />
                    <p>No doctors on the roster yet.</p>
                    <button type="button" className="btn btn-primary" onClick={openAddDoctor}>
                      <UserPlus size={16} /> Add your first doctor
                    </button>
                  </div>
                ) : (
                  <div className="roster-grid">
                    {filteredDoctors.map((doc) => {
                      const todayQueue = doc.todayQueue;
                      const accepting = isAcceptingNewPatients(doc, todayQueue);

                      return (
                        <div key={doc._id} className="roster-card">
                          <div className="roster-card__top">
                            <div className="roster-doc-info">
                              <div className="roster-avatar">
                                {doc.userId?.name ? doc.userId.name.replace('Dr. ', '').charAt(0).toUpperCase() : 'D'}
                              </div>
                              <div>
                                <div className="roster-doc-name">{doc.userId?.name || 'Unknown'}</div>
                                <div className="roster-doc-spec">
                                  {doc.specialization || 'General'} • {doc.department}
                                </div>
                              </div>
                            </div>
                            <div className="roster-card__actions">
                              <button type="button" className="icon-btn" onClick={() => openEditDoctor(doc)} title="Edit">
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn icon-btn--danger"
                                onClick={() => handleDeleteDoctor(doc)}
                                title="Remove"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          <div className="roster-contact">
                            {doc.userId?.email && (
                              <span><Mail size={14} /> {doc.userId.email}</span>
                            )}
                            {doc.userId?.phone && (
                              <span><Phone size={14} /> {doc.userId.phone}</span>
                            )}
                            <span className="roster-limit">Limit: {doc.dailyPatientLimit || 30}/day</span>
                          </div>

                          <div className="roster-actions">
                            <div className="action-row">
                              <span>
                                Physical presence
                                <span className="action-row-help">At the hospital today?</span>
                              </span>
                              <label className="toggle-switch">
                                <input
                                  type="checkbox"
                                  checked={doc.isAvailable !== 'ABSENT'}
                                  onChange={() => toggleDoctorAvailability(doc._id, doc.isAvailable)}
                                />
                                <span className="slider success"></span>
                              </label>
                            </div>

                            <div className="action-row">
                              <span className={doc.isAvailable === 'ABSENT' ? 'action-row-muted' : ''}>
                                Queue acceptance
                                <span className="action-row-help">Allow new patients to join?</span>
                              </span>
                              <label className="toggle-switch">
                                <input
                                  type="checkbox"
                                  checked={accepting}
                                  onChange={() => toggleQueueAcceptance(doc)}
                                  disabled={doc.isAvailable === 'ABSENT'}
                                />
                                <span className="slider warning"></span>
                              </label>
                            </div>
                            {doc.isAvailable === 'ABSENT' && (
                              <p className="roster-hint">Not at clinic — enable physical presence first.</p>
                            )}
                            {doc.isAvailable !== 'ABSENT' && !accepting && (
                              <p className="roster-hint">Queue paused — existing patients keep their tokens.</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {activeTab === 'departments' && (
              <DepartmentManager
                departments={departments}
                onChange={(updated) => {
                  setDepartments(updated);
                  setHospital((prev) => (prev ? { ...prev, departments: updated } : prev));
                }}
              />
            )}
          </>
        )}
      </div>

      <DoctorFormModal
        open={showDoctorModal}
        onClose={() => {
          setShowDoctorModal(false);
          setEditingDoctor(null);
        }}
        onSaved={fetchStaffData}
        departments={departments}
        editingDoctor={editingDoctor}
      />
    </div>
  );
};

export default StaffDashboard;
