import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Search, Activity, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import PatientTopbar from '../../components/common/PatientTopbar';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import './PatientDashboard.css';

function formatDoctorLabel(name) {
  if (!name) return 'Unknown';
  const cleaned = name.trim().replace(/^Dr\.?\s*/i, '');
  return `Dr. ${cleaned}`;
}

const PatientDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeQueues, setActiveQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [canceling, setCanceling] = useState(false);

  const handleCancelToken = async () => {
    if (!cancelTarget?.tokenId) return;

    try {
      setCanceling(true);
      await api.post(`/queue/tokens/${cancelTarget.tokenId}/cancel`);
      toast.success('Token canceled.');
      setCancelTarget(null);
      await fetchDashboardData();
      window.dispatchEvent(new CustomEvent('docnet:refresh_patient_queue'));
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to cancel token.');
    } finally {
      setCanceling(false);
    }
  };

  const renderQueueCard = (queue) => (
    <div key={queue.tokenId || queue.queueId} className="queue-banner__inner">
      <div className="queue-banner__info">
        <h4 className="queue-doctor-name">
          {queue.type === 'DOCTOR'
            ? formatDoctorLabel(queue.doctorName)
            : 'Dispensary queue'}
        </h4>
        <p className="queue-meta">
          {queue.hospitalName || 'Hospital'}
          {queue.department ? ` · ${queue.department}` : ''}
        </p>
        <span className="queue-token-badge">
          Token #{queue.tokenNumber}
        </span>
      </div>

      <div className="queue-ahead-block">
        <div className="queue-ahead-metric">
          <span className="queue-ahead-value">
            {queue.status === 'CALLED' ? 'Now' : queue.positionAhead}
          </span>
          <span className="queue-ahead-label">
            {queue.status === 'CALLED' ? 'Your turn' : 'Patients ahead'}
          </span>
        </div>
        <button
          type="button"
          className="queue-cancel-btn"
          onClick={() => setCancelTarget(queue)}
        >
          Cancel token
        </button>
      </div>
    </div>
  );

  useEffect(() => {
    fetchDashboardData();

    const handleQueueRefresh = () => fetchDashboardData();

    window.addEventListener('docnet:refresh_patient_queue', handleQueueRefresh);

    return () => {
      window.removeEventListener('docnet:refresh_patient_queue', handleQueueRefresh);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const queueResult = await api.get('/queue/patient/status');

      if (queueResult.data?.success) {
        const queues =
          queueResult.data.activeQueues ||
          (queueResult.data.activeQueue ? [queueResult.data.activeQueue] : []);
        setActiveQueues(queues);
      } else {
        setActiveQueues([]);
      }
    } catch (error) {
      console.error('Failed to load dashboard data', error);
      toast.error('Failed to load active queue status.');
      setActiveQueues([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container page-shell">
      <PatientTopbar />

      <div className="dashboard-body">
        <div className="dashboard-hero">
          <h1>Good day, {user?.name?.split(' ')[0] || 'there'}</h1>
          <p>Track your queue and find care when you need it.</p>
        </div>

        <div className="dashboard-grid">
          <div className="profile-panel">
            <div className="card">
              <div className="section-title">Health profile</div>
              <div className="profile-row"><span>Age</span><span>{user?.age || '—'}</span></div>
              <div className="profile-row"><span>Blood group</span><span>{user?.bloodGroup || '—'}</span></div>
              <div className="profile-row"><span>Gender</span><span>{user?.gender || '—'}</span></div>
              <div className="profile-row"><span>Allergies</span><span>{user?.allergies || 'None reported'}</span></div>
            </div>

            <button type="button" className="action-tile w-full" onClick={() => navigate('/search')}>
              <div className="action-tile__icon"><Search size={22} /></div>
              <div>
                <div className="action-tile__title">Find hospitals & doctors</div>
                <div className="action-tile__desc">Browse facilities and join a digital queue</div>
              </div>
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <div className="card queue-banner">
              <div className="section-title">
                <span className="flex items-center gap-2">
                  <Activity size={18} />
                  {activeQueues.length > 1 ? 'Active queues' : 'Active queue'}
                </span>
              </div>

              {loading ? (
                <div className="empty-state" style={{ padding: '2rem' }}>Loading queue…</div>
              ) : activeQueues.length > 0 ? (
                <div className={activeQueues.length > 1 ? 'queue-banner__stack' : undefined}>
                  {activeQueues.map((queue) => renderQueueCard(queue))}
                </div>
              ) : (
                <div className="empty-state">
                  <Clock size={28} style={{ color: 'var(--border-strong)' }} />
                  <p>You are not in a queue right now.</p>
                  <button type="button" className="btn btn-primary" onClick={() => navigate('/search')}>
                    Find a doctor
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel token?"
        message="Do you want to cancel the token?"
        confirmLabel="Yes, cancel"
        cancelLabel="Keep token"
        onConfirm={handleCancelToken}
        onCancel={() => !canceling && setCancelTarget(null)}
        loading={canceling}
      />
    </div>
  );
};

export default PatientDashboard;
