import React, { useEffect, useState } from 'react';
import { X, Wand2, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  phone: '',
  department: '',
  specialization: '',
  dailyPatientLimit: 30,
  isAvailable: 'AVAILABLE',
};

const DoctorFormModal = ({ open, onClose, onSaved, departments, editingDoctor }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const isEdit = Boolean(editingDoctor);

  useEffect(() => {
    if (!open) return;

    if (editingDoctor) {
      setForm({
        name: editingDoctor.userId?.name || editingDoctor.name || '',
        email: editingDoctor.userId?.email || editingDoctor.email || '',
        password: '',
        phone: editingDoctor.userId?.phone || editingDoctor.phone || '',
        department: editingDoctor.department || '',
        specialization: editingDoctor.specialization || '',
        dailyPatientLimit: editingDoctor.dailyPatientLimit || 30,
        isAvailable: editingDoctor.isAvailable || 'AVAILABLE',
      });
    } else {
      setForm({
        ...EMPTY_FORM,
        department: departments[0] || '',
      });
    }
  }, [open, editingDoctor, departments]);

  if (!open) return null;

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const loadDemoTemplate = async () => {
    try {
      setLoadingTemplate(true);
      const res = await api.get('/auth/staff/doctors/template');
      if (res.data?.template) {
        setForm((prev) => ({
          ...prev,
          ...res.data.template,
          password: res.data.template.password || prev.password,
        }));
        toast.success('Loaded createDoctor.js defaults — edit before saving.');
      }
    } catch (error) {
      toast.error('Could not load demo template.');
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name || !form.email || !form.department) {
      toast.error('Name, email, and department are required.');
      return;
    }
    if (!isEdit && !form.password) {
      toast.error('Password is required for new doctors.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        department: form.department,
        specialization: form.specialization.trim(),
        dailyPatientLimit: Number(form.dailyPatientLimit) || 30,
        isAvailable: form.isAvailable,
      };

      if (form.password) payload.password = form.password;

      if (isEdit) {
        await api.patch(`/auth/staff/doctors/${editingDoctor._id}`, payload);
        toast.success('Doctor profile updated.');
      } else {
        await api.post('/auth/staff/doctors', payload);
        toast.success('Doctor added to roster.');
      }

      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save doctor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="staff-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="staff-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-labelledby="doctor-form-title"
      >
        <div className="staff-modal__header">
          <div>
            <h2 id="doctor-form-title">{isEdit ? 'Edit Doctor' : 'Add Doctor'}</h2>
            <p className="staff-modal__subtitle">
              {isEdit
                ? 'Update credentials and professional details.'
                : 'Creates login + doctor profile (same as createDoctor.js script).'}
            </p>
          </div>
          <button type="button" className="staff-modal__close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {!isEdit && (
          <div className="staff-template-bar">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={loadDemoTemplate}
              disabled={loadingTemplate}
            >
              <Wand2 size={16} /> Load script template
            </button>
            <span className="staff-template-hint">Pre-fills chavla@docnet.com defaults from createDoctor.js</span>
          </div>
        )}

        <form className="staff-form" onSubmit={handleSubmit}>
          <div className="staff-form-grid">
            <label className="staff-field">
              <span>Full name</span>
              <input
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Dr. Jane Smith"
                required
              />
            </label>

            <label className="staff-field">
              <span>Email (login)</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="doctor@hospital.com"
                required
              />
            </label>

            <label className="staff-field">
              <span>{isEdit ? 'New password (optional)' : 'Password'}</span>
              <input
                type="password"
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                placeholder={isEdit ? 'Leave blank to keep current' : 'Min. 8 characters'}
                minLength={isEdit ? undefined : 6}
              />
            </label>

            <label className="staff-field">
              <span>Phone</span>
              <input
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="9876543210"
              />
            </label>

            <label className="staff-field">
              <span>Department</span>
              <select
                value={form.department}
                onChange={(e) => updateField('department', e.target.value)}
                required
              >
                <option value="">Select department</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </label>

            <label className="staff-field">
              <span>Specialization</span>
              <input
                value={form.specialization}
                onChange={(e) => updateField('specialization', e.target.value)}
                placeholder="Cardiologist, Pediatrician…"
              />
            </label>

            <label className="staff-field">
              <span>Daily patient limit</span>
              <input
                type="number"
                min={1}
                max={200}
                value={form.dailyPatientLimit}
                onChange={(e) => updateField('dailyPatientLimit', e.target.value)}
              />
            </label>

            <label className="staff-field">
              <span>Availability status</span>
              <select
                value={form.isAvailable}
                onChange={(e) => updateField('isAvailable', e.target.value)}
              >
                <option value="AVAILABLE">Available</option>
                <option value="PAUSED">Paused</option>
                <option value="ABSENT">Absent</option>
              </select>
            </label>
          </div>

          <div className="staff-modal__actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <UserPlus size={16} />
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create doctor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DoctorFormModal;
