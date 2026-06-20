import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Linkedin, Instagram, Shield, ArrowUpRight } from 'lucide-react';
import BrandMark from './BrandMark';
import './SiteFooter.css';

const FEATURES = [
  { label: 'Live queue & tokens', to: '/login', hint: 'Real-time waiting lines' },
  { label: 'Hospital search', to: '/login', hint: 'Find care near you' },
  { label: 'Digital prescriptions', to: '/login', hint: 'Paperless Rx history' },
  { label: 'Handwriting canvas', to: '/login', hint: 'Doctor TrOCR notes' },
  { label: 'Doctor roster', to: '/login', hint: 'Departments & availability' },
  { label: 'Patient profiles', to: '/signup', hint: 'Allergies & vitals' },
];

const PORTALS = [
  { label: 'Patient sign in', to: '/login' },
  { label: 'Patient registration', to: '/signup' },
  { label: 'Doctor portal', to: '/login' },
  { label: 'Staff portal', to: '/login' },
];

const SiteFooter = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <BrandMark light />
          <Link to="/platform/login" className="site-footer__admin-pill">
            <Shield size={13} />
            Platform admin
          </Link>
          <p className="site-footer__tagline">
            Hospital queues and digital prescriptions — calm, connected care for patients, doctors, and staff.
          </p>
          <a className="site-footer__email" href="mailto:akakashkumar1711@gmail.com">
            <Mail size={16} />
            akakashkumar1711@gmail.com
          </a>
        </div>

        <div className="site-footer__col">
          <h3>Features</h3>
          <ul>
            {FEATURES.map((item) => (
              <li key={item.label}>
                <Link to={item.to}>
                  {item.label}
                  <ArrowUpRight size={13} className="site-footer__link-icon" />
                </Link>
                <span className="site-footer__hint">{item.hint}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="site-footer__col">
          <h3>Portals</h3>
          <ul>
            {PORTALS.map((item) => (
              <li key={item.label}>
                <Link to={item.to}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="site-footer__col">
          <h3>Reach out</h3>
          <p className="site-footer__reach-copy">
            Questions, partnerships, or feedback — we&apos;d love to hear from you.
          </p>
          <ul className="site-footer__social">
            <li>
              <a
                href="mailto:akakashkumar1711@gmail.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Mail size={16} />
                Email
              </a>
            </li>
            <li>
              <a
                href="https://www.linkedin.com/in/akash-kgpian/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Linkedin size={16} />
                LinkedIn
              </a>
            </li>
            <li>
              <a
                href="https://www.instagram.com/akash_ntg/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Instagram size={16} />
                Instagram
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="site-footer__bar">
        <span>© {new Date().getFullYear()} DocNet — Care, Connected</span>
        <div className="site-footer__bar-links">
          <Link to="/platform/login">Platform admin</Link>
          <a href="https://www.linkedin.com/in/akash-kgpian/" target="_blank" rel="noopener noreferrer">
            LinkedIn
          </a>
          <a href="https://www.instagram.com/akash_ntg/" target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
        </div>
        <button type="button" className="site-footer__top" onClick={scrollToTop} aria-label="Back to top">
          ↑
        </button>
      </div>
    </footer>
  );
};

export default SiteFooter;
