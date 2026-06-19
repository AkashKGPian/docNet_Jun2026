import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  ChevronRight,
  Pill,
  Search,
  CalendarDays,
  Stethoscope,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import PatientTopbar from '../../components/common/PatientTopbar';
import './PrescriptionHistory.css';

function formatDoctorLabel(name) {
  if (!name) return 'Unknown doctor';
  const cleaned = name.trim().replace(/^Dr\.?\s*/i, '');
  return `Dr. ${cleaned}`;
}

function formatShortDate(value) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatMonthLabel(value) {
  return new Date(value).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

function groupByMonth(records) {
  return records.reduce((groups, record) => {
    const key = formatMonthLabel(record.createdAt);
    if (!groups[key]) groups[key] = [];
    groups[key].push(record);
    return groups;
  }, {});
}

const PrescriptionHistory = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchHistory();

    const handleRefresh = () => fetchHistory();
    window.addEventListener('docnet:refresh_patient_history', handleRefresh);
    return () => window.removeEventListener('docnet:refresh_patient_history', handleRefresh);
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await api.get('/prescriptions/history');
      if (res.data?.success) {
        setHistory(res.data.history || []);
      } else {
        setHistory([]);
      }
    } catch (error) {
      console.error('Failed to load prescription history', error);
      toast.error('Failed to load prescriptions.');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return history;

    return history.filter((record) => {
      const doctor = formatDoctorLabel(record.doctorId?.userId?.name).toLowerCase();
      const hospital = (record.storeId?.name || '').toLowerCase();
      const heading = (record.heading || '').toLowerCase();
      const department = (record.doctorId?.department || '').toLowerCase();
      return (
        doctor.includes(normalized) ||
        hospital.includes(normalized) ||
        heading.includes(normalized) ||
        department.includes(normalized)
      );
    });
  }, [history, query]);

  const groupedHistory = useMemo(
    () => groupByMonth(filteredHistory),
    [filteredHistory]
  );

  const monthKeys = Object.keys(groupedHistory);

  return (
    <div className="rx-history-page page-shell">
      <PatientTopbar />

      <div className="rx-history-body">
        <header className="rx-history-hero">
          <div>
            <p className="rx-history-eyebrow">Medical records</p>
            <h1>Your prescriptions</h1>
            <p className="rx-history-lead">
              Every confirmed digital prescription from your visits — searchable, dated, and ready to open.
            </p>
          </div>
          <div className="rx-history-stat" aria-live="polite">
            <span className="rx-history-stat__value">{history.length}</span>
            <span className="rx-history-stat__label">Total records</span>
          </div>
        </header>

        <div className="rx-history-toolbar">
          <label className="rx-history-search">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by doctor, hospital, or diagnosis…"
              aria-label="Search prescriptions"
            />
          </label>
        </div>

        {loading ? (
          <div className="rx-history-empty">
            <div className="rx-history-empty__icon rx-history-empty__icon--pulse">
              <FileText size={28} />
            </div>
            <p>Loading your prescriptions…</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="rx-history-empty">
            <div className="rx-history-empty__icon">
              <FileText size={32} />
            </div>
            <h2>{query ? 'No matches found' : 'No prescriptions yet'}</h2>
            <p>
              {query
                ? 'Try a different doctor name, hospital, or diagnosis keyword.'
                : 'After a visit, your doctor will share a digital prescription here automatically.'}
            </p>
            {!query ? (
              <button type="button" className="btn btn-primary" onClick={() => navigate('/search')}>
                Find a doctor
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={() => setQuery('')}>
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="rx-history-timeline">
            {monthKeys.map((month) => (
              <section key={month} className="rx-history-month">
                <h2 className="rx-history-month__label">
                  <CalendarDays size={16} />
                  {month}
                </h2>

                <ul className="rx-history-list">
                  {groupedHistory[month].map((record) => {
                    const medicineCount = record.medicines?.length || 0;
                    const doctorName = formatDoctorLabel(record.doctorId?.userId?.name);

                    return (
                      <li key={record._id}>
                        <button
                          type="button"
                          className="rx-history-row"
                          onClick={() => navigate(`/prescription/${record._id}`)}
                        >
                          <div className="rx-history-row__date">
                            <span className="rx-history-row__day">
                              {new Date(record.createdAt).getDate()}
                            </span>
                            <span className="rx-history-row__month">
                              {new Date(record.createdAt).toLocaleDateString('en-IN', { month: 'short' })}
                            </span>
                          </div>

                          <div className="rx-history-row__avatar" aria-hidden="true">
                            {doctorName.replace(/^Dr\.\s*/i, '').charAt(0)}
                          </div>

                          <div className="rx-history-row__content">
                            <div className="rx-history-row__title">
                              {record.heading?.trim() || 'Prescription'}
                            </div>
                            <div className="rx-history-row__meta">
                              <span className="rx-history-row__doctor">
                                <Stethoscope size={14} />
                                {doctorName}
                              </span>
                              <span>{record.storeId?.name || 'Hospital'}</span>
                              {record.doctorId?.department ? (
                                <span>{record.doctorId.department}</span>
                              ) : null}
                            </div>
                            <div className="rx-history-row__tags">
                              <span className="rx-history-tag">
                                <Pill size={13} />
                                {medicineCount} medicine{medicineCount === 1 ? '' : 's'}
                              </span>
                              <span className="rx-history-tag">{formatShortDate(record.createdAt)}</span>
                            </div>
                          </div>

                          <ChevronRight size={18} className="rx-history-row__chevron" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PrescriptionHistory;
