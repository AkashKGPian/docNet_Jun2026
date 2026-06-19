import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import PatientTopbar from '../../components/common/PatientTopbar';
import './HospitalSearch.css';

const HospitalSearch = () => {
  const [query, setQuery] = useState('');
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchHospitals(query);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const fetchHospitals = async (searchQuery) => {
    try {
      setLoading(true);
      const res = await api.get('/stores/search', { params: { query: searchQuery } });
      if (res.data?.success) {
        setHospitals(res.data.hospitals);
      }
    } catch (error) {
      console.error('Failed to fetch hospitals', error);
      toast.error('Unable to connect to hospital directory.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-page page-shell">
      <PatientTopbar />

      <div className="search-body container">
        <section className="search-hero">
          <div className="search-hero__intro">
            <p className="search-hero__eyebrow">Find care</p>
            <h1>Find a hospital or clinic</h1>
            <p className="search-hero__lead">
              Search by name, location, or department to join a digital queue.
            </p>
          </div>

          <label className="search-hero__field">
            <span className="search-hero__icon" aria-hidden="true">
              <Search size={20} />
            </span>
            <input
              type="search"
              className="search-hero__input"
              placeholder="Search hospitals — e.g. Apollo, City Heart, Pediatrics…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search hospitals"
            />
          </label>
        </section>

      {loading && hospitals.length === 0 ? (
        <div className="text-center py-12 text-slate-400 animate-pulse">Loading hospitals...</div>
      ) : (
        <div className="hospital-grid">
          {hospitals.length > 0 ? (
            hospitals.map((hospital) => (
              <div
                key={hospital._id}
                className={`card glass hospital-card ${!hospital.isOpen ? 'hospital-card-closed' : ''}`}
                onClick={() => navigate(`/hospital/${hospital._id}`)}
              >
                <div className="flex justify-between items-start">
                  <div className="hospital-icon">
                    <Building2 size={24} />
                  </div>
                  <span className={`badge ${hospital.isOpen ? 'badge-open' : 'badge-closed'}`}>
                    {hospital.isOpen ? 'Open Now' : 'Closed'}
                  </span>
                </div>

                <div className="hospital-info">
                  <h3>{hospital.name}</h3>
                  {!hospital.isOpen && (
                    <p className="closed-notice">This facility is closed today. You can view details but cannot join a queue.</p>
                  )}
                  <div className="hospital-meta">
                    <div className="hospital-meta-item">
                      <MapPin size={14} /> {hospital.address || 'Location generic'}
                    </div>
                    {hospital.departments && hospital.departments.length > 0 && (
                      <div className="hospital-meta-item mt-2 pt-2 border-t border-slate-100 flex-wrap">
                        {hospital.departments.slice(0, 3).map((dept, index) => (
                          <span key={index} className="dept-chip">
                            {dept}
                          </span>
                        ))}
                        {hospital.departments.length > 3 && (
                          <span className="text-xs text-slate-400">
                            +{hospital.departments.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-slate-500">
              <Building2 size={48} className="mx-auto mb-4 text-slate-300" />
              <p>No hospitals found matching "{query}"</p>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
};

export default HospitalSearch;
