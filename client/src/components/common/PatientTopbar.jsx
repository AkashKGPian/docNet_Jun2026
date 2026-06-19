import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import BrandMark from './BrandMark';
import { useAuth } from '../../context/AuthContext';
import { getAssetUrl } from '../../utils/api';

const PatientTopbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [photoFailed, setPhotoFailed] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/patient', label: 'Home' },
    { to: '/search', label: 'Find care' },
    { to: '/prescriptions', label: 'Prescriptions' },
  ];

  const isNavActive = (to) => {
    if (to === '/prescriptions') {
      return location.pathname === '/prescriptions' || location.pathname.startsWith('/prescription/');
    }
    if (to === '/patient') {
      return location.pathname === '/patient';
    }
    return location.pathname === to;
  };

  const profilePhoto = !photoFailed ? getAssetUrl(user?.profilePicture) : null;
  const avatarInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'P';
  const isProfileActive = location.pathname === '/patient/profile';

  // Reset fallback when user photo changes (e.g. after upload)
  useEffect(() => {
    setPhotoFailed(false);
  }, [user?.profilePicture]);

  return (
    <header className="page-topbar">
      <BrandMark compact={false} />

      <nav className="page-topbar__nav" aria-label="Patient navigation">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`page-topbar__link ${isNavActive(item.to) ? 'is-active' : ''}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <Link
          to="/patient/profile"
          className={`topbar-user topbar-user--clickable ${isProfileActive ? 'is-active' : ''}`}
          title="Edit profile"
        >
          <div className="topbar-user__avatar">
            {profilePhoto ? (
              <img
                src={profilePhoto}
                alt=""
                className="topbar-user__avatar-image"
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              avatarInitial
            )}
          </div>
          <div className="topbar-user__meta">
            <span className="topbar-user__name">{user?.name || 'Patient'}</span>
            <span className="topbar-user__role">Edit profile</span>
          </div>
        </Link>
        <button type="button" onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem' }}>
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
};

export default PatientTopbar;
