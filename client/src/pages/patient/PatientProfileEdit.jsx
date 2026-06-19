import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, User, Mail, Phone, MapPin, Droplet, Hash } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getAssetUrl } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import PatientTopbar from '../../components/common/PatientTopbar';
import './PatientProfileEdit.css';

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  age: '',
  gender: 'M',
  bloodGroup: '',
  allergies: '',
  address: '',
};

const PatientProfileEdit = () => {
  const navigate = useNavigate();
  const { user, checkCurrentUser } = useAuth();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [currentPhoto, setCurrentPhoto] = useState(null);

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/patient/me');
      const profile = res.data?.user;
      if (!profile) return;

      setForm({
        name: profile.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        age: profile.age ?? '',
        gender: profile.gender || 'M',
        bloodGroup: profile.bloodGroup || '',
        allergies: Array.isArray(profile.allergies) ? profile.allergies.join(', ') : '',
        address: profile.address || '',
      });
      setCurrentPhoto(profile.profilePicture || null);
    } catch (error) {
      console.error('Failed to load profile', error);
      toast.error('Could not load your profile.');
      navigate('/patient');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Profile photo must be 2 MB or smaller.');
      return;
    }

    if (photoPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Name and email are required.');
      return;
    }

    try {
      setSaving(true);

      if (photoFile) {
        const photoData = new FormData();
        photoData.append('photo', photoFile);
        const photoRes = await api.post('/auth/patient/profile/photo', photoData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (photoRes.data?.user?.profilePicture) {
          setCurrentPhoto(photoRes.data.user.profilePicture);
        }
      }

      const res = await api.patch('/auth/patient/profile', {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        age: form.age === '' ? null : Number(form.age),
        gender: form.gender,
        bloodGroup: form.bloodGroup.trim(),
        allergies: form.allergies,
        address: form.address.trim(),
      });

      await checkCurrentUser();
      toast.success(res.data?.message || 'Profile saved.');
      setPhotoFile(null);
      navigate('/patient');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const displayPhoto = photoPreview || getAssetUrl(currentPhoto);
  const avatarInitial = form.name?.charAt(0)?.toUpperCase() || user?.name?.charAt(0)?.toUpperCase() || 'P';

  return (
    <div className="profile-edit-page page-shell">
      <PatientTopbar />

      <div className="profile-edit-body container">
        <button type="button" className="btn btn-secondary w-fit profile-edit-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> Back
        </button>

        <header className="profile-edit-hero">
          <p className="profile-edit-eyebrow">Account</p>
          <h1>Edit profile</h1>
          <p className="profile-edit-lead">Update your photo, contact details, and health information.</p>
        </header>

        {loading ? (
          <div className="profile-edit-empty">Loading profile…</div>
        ) : (
          <form className="profile-edit-card" onSubmit={handleSave}>
            <section className="profile-photo-section">
              <div className="profile-photo-preview">
                {displayPhoto ? (
                  <img src={displayPhoto} alt="" className="profile-photo-preview__image" />
                ) : (
                  <span className="profile-photo-preview__initial">{avatarInitial}</span>
                )}
              </div>

              <div className="profile-photo-copy">
                <h2>Profile photo</h2>
                <p>JPG, PNG, WebP or GIF. Max 2 MB.</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="profile-photo-input"
                  onChange={handlePhotoSelect}
                />
                <button
                  type="button"
                  className="btn btn-secondary profile-photo-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera size={16} />
                  {photoFile ? 'Change photo' : 'Upload photo'}
                </button>
              </div>
            </section>

            <section className="profile-form-section">
              <h2>Personal details</h2>
              <div className="profile-form-grid">
                <label className="profile-field profile-field--wide">
                  <span>Full name</span>
                  <div className="profile-field__control">
                    <User size={16} />
                    <input type="text" name="name" value={form.name} onChange={handleChange} required />
                  </div>
                </label>

                <label className="profile-field">
                  <span>Email</span>
                  <div className="profile-field__control">
                    <Mail size={16} />
                    <input type="email" name="email" value={form.email} onChange={handleChange} required />
                  </div>
                </label>

                <label className="profile-field">
                  <span>Phone</span>
                  <div className="profile-field__control">
                    <Phone size={16} />
                    <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="+91…" />
                  </div>
                </label>

                <label className="profile-field">
                  <span>Age</span>
                  <div className="profile-field__control">
                    <Hash size={16} />
                    <input type="number" name="age" min="0" max="120" value={form.age} onChange={handleChange} />
                  </div>
                </label>

                <label className="profile-field">
                  <span>Gender</span>
                  <div className="profile-field__control">
                    <select name="gender" value={form.gender} onChange={handleChange}>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </label>

                <label className="profile-field">
                  <span>Blood group</span>
                  <div className="profile-field__control">
                    <Droplet size={16} />
                    <input type="text" name="bloodGroup" value={form.bloodGroup} onChange={handleChange} placeholder="O+" />
                  </div>
                </label>

                <label className="profile-field profile-field--wide">
                  <span>Address</span>
                  <div className="profile-field__control">
                    <MapPin size={16} />
                    <input type="text" name="address" value={form.address} onChange={handleChange} placeholder="Street, city, state" />
                  </div>
                </label>

                <label className="profile-field profile-field--wide">
                  <span>Allergies</span>
                  <div className="profile-field__control">
                    <input
                      type="text"
                      name="allergies"
                      value={form.allergies}
                      onChange={handleChange}
                      placeholder="Penicillin, Aspirin (comma separated)"
                    />
                  </div>
                </label>
              </div>
            </section>

            <div className="profile-edit-actions">
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/patient')} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default PatientProfileEdit;
