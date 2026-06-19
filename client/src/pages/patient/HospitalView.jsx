import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Users, Activity, ArrowLeft, Radio, Clock, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useSocket } from '../../context/SocketContext';
import PatientTopbar from '../../components/common/PatientTopbar';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import './HospitalView.css';

const DOCTOR_STATUS = {
  AVAILABLE: { shortLabel: 'Available', pillClass: 'is-available' },
  PAUSED: { shortLabel: 'Paused', pillClass: 'is-paused' },
  ABSENT: { shortLabel: 'Unavailable', pillClass: 'is-unavailable' },
};

function formatDoctorLabel(name) {
  if (!name) return 'Unknown';
  const cleaned = name.trim().replace(/^Dr\.?\s*/i, '');
  return `Dr. ${cleaned}`;
}

function aheadMessage(count) {
  if (count === 0) return 'No one ahead — shortest wait right now';
  if (count === 1) return '1 patient ahead if you join now';
  return `${count} patients ahead if you join now`;
}

function getJoinLabel(doc, preview, hospital, joiningDoctorId) {
  if (!hospital?.isOpen) return 'Hospital closed';
  if (doc.isAvailable === 'ABSENT') return 'Unavailable today';
  if (doc.isAvailable === 'PAUSED' || preview?.isPaused) return 'Queue paused';
  if (joiningDoctorId === doc._id) return 'Joining…';

  const ahead = preview?.patientsAheadIfJoin;
  if (ahead != null) return ahead === 0 ? 'Join now — no wait' : `Join — ${ahead} ahead`;
  return 'Join queue';
}

function renderTokenPanel(activeQueue, onCancelClick) {
  const isCalled = activeQueue.status === 'CALLED';
  const ahead = activeQueue.positionAhead ?? 0;

  return (
    <div className={`doctor-token-panel ${isCalled ? 'doctor-token-panel--called' : ''}`}>
      <div className="doctor-token-panel__content">
        <p className="doctor-token-panel__title">
          {isCalled
            ? 'Proceed to the doctor\'s cabin'
            : ahead === 0
              ? 'You\'re next in line'
              : `${ahead} patient${ahead === 1 ? '' : 's'} before you`}
        </p>
        <div className="doctor-token-panel__meta">
          <span className={`token-meta-chip ${isCalled ? 'is-called' : 'is-waiting'}`}>
            {isCalled ? <CheckCircle2 size={12} /> : <Clock size={12} />}
            {isCalled ? 'Called' : 'Waiting'}
          </span>
          <span className="token-meta-ref">Ref #{activeQueue.tokenNumber}</span>
        </div>
        <span className="doctor-token-panel__live">
          <Radio size={12} /> Live queue position
        </span>
      </div>

      <aside className="doctor-token-panel__aside">
        <div className="doctor-token-panel__metric">
          <span className="doctor-token-panel__number">{isCalled ? 'Now' : ahead}</span>
          <span className="doctor-token-panel__unit">
            {isCalled ? 'your turn' : 'ahead'}
          </span>
        </div>
        <button type="button" className="doctor-token-panel__cancel" onClick={onCancelClick}>
          Cancel token
        </button>
      </aside>
    </div>
  );
}

const HospitalView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();

  const [hospital, setHospital] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joiningDoctorId, setJoiningDoctorId] = useState(null);
  const [grantHistoryAccess, setGrantHistoryAccess] = useState(true);
  const [activeQueues, setActiveQueues] = useState([]);
  const [liveDoctorIds, setLiveDoctorIds] = useState(new Set());
  const [cancelTarget, setCancelTarget] = useState(null);
  const [canceling, setCanceling] = useState(false);

  const getQueueForDoctor = useCallback(
    (doctorId) =>
      activeQueues.find((queue) => String(queue.doctorId) === String(doctorId)) || null,
    [activeQueues]
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/stores/${id}`);
      if (res.data?.success) {
        setHospital(res.data.hospital);
        setDoctors(res.data.doctors);
      }
    } catch (error) {
      console.error('Failed to fetch hospital', error);
      toast.error('Could not load hospital data.');
      navigate('/search');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  const fetchPatientQueue = useCallback(async () => {
    try {
      const res = await api.get('/queue/patient/status');
      if (res.data?.success) {
        const queues = res.data.activeQueues || (res.data.activeQueue ? [res.data.activeQueue] : []);
        setActiveQueues(queues.filter((q) => q.type === 'DOCTOR'));
      } else {
        setActiveQueues([]);
      }
    } catch {
      setActiveQueues([]);
    }
  }, []);

  const flashDoctorLive = useCallback((doctorId) => {
    setLiveDoctorIds((prev) => new Set(prev).add(String(doctorId)));
    setTimeout(() => {
      setLiveDoctorIds((prev) => {
        const next = new Set(prev);
        next.delete(String(doctorId));
        return next;
      });
    }, 1200);
  }, []);

  useEffect(() => {
    fetchData();
    fetchPatientQueue();

    const refreshQueue = () => fetchPatientQueue();
    window.addEventListener('docnet:refresh_patient_queue', refreshQueue);
    return () => window.removeEventListener('docnet:refresh_patient_queue', refreshQueue);
  }, [fetchData, fetchPatientQueue]);

  useEffect(() => {
    if (!socket || !id) return;

    socket.emit('join_store_room', id);

    const applyQueuePreview = (data) => {
      if (String(data.storeId) !== String(id)) return;

      setDoctors((prev) =>
        prev.map((doc) => {
          if (String(doc._id) !== String(data.doctorId)) return doc;

          const accepting = doc.isAvailable === 'AVAILABLE' && !doc.queuePreview?.isPaused;
          return {
            ...doc,
            queuePreview: {
              ...doc.queuePreview,
              queueId: data.queueId,
              waitingCount: data.waitingCount,
              patientsAheadIfJoin: accepting ? data.patientsAheadIfJoin : null,
              isLive: accepting,
            },
          };
        })
      );

      fetchPatientQueue();
    };

    const handleQueueStatus = (data) => {
      setDoctors((prev) =>
        prev.map((doc) => {
          if (String(doc.queuePreview?.queueId) !== String(data.queueId)) return doc;

          const accepting = !data.isPaused && doc.isAvailable === 'AVAILABLE';
          return {
            ...doc,
            queuePreview: {
              ...doc.queuePreview,
              isPaused: data.isPaused,
              isLive: accepting,
              patientsAheadIfJoin: accepting ? doc.queuePreview?.waitingCount ?? 0 : null,
            },
          };
        })
      );
    };

    const handleDoctorAvailability = (data) => {
      if (String(data.storeId) !== String(id)) return;

      setDoctors((prev) =>
        prev.map((doc) => {
          if (String(doc._id) !== String(data.doctorId)) return doc;
          return {
            ...doc,
            isAvailable: data.isAvailable,
            queuePreview: data.queuePreview || doc.queuePreview,
          };
        })
      );

      flashDoctorLive(data.doctorId);
    };

    socket.on('store:queue_preview', applyQueuePreview);
    socket.on('store:queue_status_changed', handleQueueStatus);
    socket.on('store:doctor_availability', handleDoctorAvailability);

    return () => {
      socket.off('store:queue_preview', applyQueuePreview);
      socket.off('store:queue_status_changed', handleQueueStatus);
      socket.off('store:doctor_availability', handleDoctorAvailability);
    };
  }, [socket, id, flashDoctorLive, fetchPatientQueue]);

  const handleCancelToken = async () => {
    if (!cancelTarget?.tokenId) return;

    try {
      setCanceling(true);
      await api.post(`/queue/tokens/${cancelTarget.tokenId}/cancel`);
      toast.success('Token canceled.');
      setCancelTarget(null);
      await fetchPatientQueue();
      window.dispatchEvent(new CustomEvent('docnet:refresh_patient_queue'));
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to cancel token.');
    } finally {
      setCanceling(false);
    }
  };

  const canJoinDoctor = (doctor) => {
    if (!hospital?.isOpen) return false;
    if (doctor.isAvailable !== 'AVAILABLE') return false;
    if (doctor.queuePreview?.isPaused) return false;
    if (getQueueForDoctor(doctor._id)) return false;
    return true;
  };

  const handleJoinQueue = async (doctorId) => {
    if (getQueueForDoctor(doctorId)) {
      toast.error('You already have a token with this doctor.');
      return;
    }

    try {
      setJoiningDoctorId(doctorId);

      const res = await api.post('/queue/join', {
        storeId: hospital._id,
        doctorId,
        type: 'DOCTOR',
        grantHistoryAccess,
      });

      const ahead = res.data.token?.positionAhead ?? 0;
      toast.success(
        ahead === 0
          ? 'You\'re in line — no patients ahead of you!'
          : `You're in line — ${ahead} patient${ahead === 1 ? '' : 's'} ahead of you.`
      );
      await fetchPatientQueue();
    } catch (error) {
      const message = error.response?.data?.error;
      if (error.response?.status === 409) {
        toast.error(message || 'You already have a token with this doctor.');
        await fetchPatientQueue();
      } else {
        toast.error(message || 'Failed to join queue.');
      }
    } finally {
      setJoiningDoctorId(null);
    }
  };

  if (loading) {
    return (
      <div className="hospital-view-container page-shell">
        <PatientTopbar />
        <div className="hospital-view-body container empty-state">Loading facility…</div>
      </div>
    );
  }

  if (!hospital) return null;

  return (
    <div className="hospital-view-container page-shell">
      <PatientTopbar />

      <div className="hospital-view-body container">
        <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary w-fit back-link">
          <ArrowLeft size={18} /> Back to search
        </button>

        <div className={`hospital-hero ${!hospital.isOpen ? 'hospital-hero-closed' : ''}`}>
          <div className="hospital-hero-left">
            <h1>{hospital.name}</h1>
            <p><MapPin size={18} /> {hospital.address}</p>
            <div className="dept-row">
              {hospital.departments.map((dept, index) => (
                <span key={index} className="dept-chip">{dept}</span>
              ))}
            </div>
          </div>
          <div className="text-right hidden md:block">
            <div className={`badge ${hospital.isOpen ? 'badge-open' : 'badge-closed'}`}>
              {hospital.isOpen ? 'Accepting patients' : 'Closed today'}
            </div>
          </div>
        </div>

        <div>
          <h2 className="section-heading">
            <Users size={22} /> Choose a doctor
          </h2>
          <p className="section-subheading">
            Join one doctor at a time per queue — you can hold tokens with multiple doctors, but not twice with the same doctor.
          </p>

          <label className="history-access-consent">
            <input
              type="checkbox"
              checked={grantHistoryAccess}
              onChange={(event) => setGrantHistoryAccess(event.target.checked)}
            />
            <span>
              Allow the doctor to view my past digital prescriptions when I join their queue.
            </span>
          </label>

          {doctors.length === 0 ? (
            <div className="card empty-doctors">
              <Activity size={40} />
              <p>No doctors are currently listed at this facility.</p>
            </div>
          ) : (
            <div className="doctor-grid">
              {doctors.map((doc) => {
                const status = DOCTOR_STATUS[doc.isAvailable] || DOCTOR_STATUS.AVAILABLE;
                const doctorQueue = getQueueForDoctor(doc._id);
                const alreadyInQueue = Boolean(doctorQueue);
                const joinEnabled = canJoinDoctor(doc);
                const preview = doc.queuePreview;
                const aheadCount = preview?.patientsAheadIfJoin;
                const showWaitHero = doc.isAvailable === 'AVAILABLE' && !alreadyInQueue && !preview?.isPaused;
                const isFlashing = liveDoctorIds.has(String(doc._id));

                const renderMiddle = () => {
                  if (alreadyInQueue && doctorQueue) {
                    return renderTokenPanel(doctorQueue, () => setCancelTarget(doctorQueue));
                  }
                  if (showWaitHero) {
                    return (
                      <div className="doctor-wait-hero">
                        <div className="doctor-wait-hero__metric">
                          <span className="doctor-wait-hero__number">{aheadCount ?? 0}</span>
                          <span className="doctor-wait-hero__unit">ahead</span>
                        </div>
                        <div className="doctor-wait-hero__copy">
                          <p>{aheadMessage(aheadCount ?? 0)}</p>
                          <span className="doctor-wait-hero__live">
                            <Radio size={12} /> Live wait estimate
                          </span>
                        </div>
                      </div>
                    );
                  }
                  if (doc.isAvailable === 'PAUSED' || preview?.isPaused) {
                    return (
                      <p className="doctor-card-v2__hint doctor-card-v2__hint--paused">
                        Not accepting new patients right now
                      </p>
                    );
                  }
                  if (doc.isAvailable === 'ABSENT') {
                    return (
                      <p className="doctor-card-v2__hint">Not at clinic today</p>
                    );
                  }
                  return null;
                };

                return (
                  <article
                    key={doc._id}
                    className={[
                      'doctor-card-v2',
                      joinEnabled ? 'doctor-card-v2--joinable' : '',
                      alreadyInQueue ? 'doctor-card-v2--booked' : '',
                      isFlashing ? 'doctor-card-v2--flash' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <header className="doctor-card-v2__head">
                      <div className="doctor-card-v2__profile">
                        <div className="doc-avatar">
                          {doc.userId?.name
                            ? doc.userId.name.replace(/^Dr\.?\s*/i, '').charAt(0).toUpperCase()
                            : 'D'}
                        </div>
                        <div>
                          <h3>{formatDoctorLabel(doc.userId?.name)}</h3>
                          <p>{doc.specialization || 'General'} · {doc.department}</p>
                        </div>
                      </div>
                      {alreadyInQueue ? (
                        <span className="doctor-booked-badge">Your token</span>
                      ) : (
                        <span className={`doctor-status-pill ${status.pillClass}`}>
                          {status.shortLabel}
                        </span>
                      )}
                    </header>

                    {renderMiddle()}

                    {!alreadyInQueue ? (
                      <button
                        type="button"
                        className={`btn-join-v2 ${joinEnabled ? 'btn-join-v2--primary' : ''}`}
                        onClick={() => handleJoinQueue(doc._id)}
                        disabled={!joinEnabled || joiningDoctorId === doc._id}
                      >
                        {getJoinLabel(doc, preview, hospital, joiningDoctorId)}
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
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

export default HospitalView;
