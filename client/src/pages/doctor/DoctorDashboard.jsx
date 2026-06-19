import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Users, LogOut, Settings, Clock, CheckCircle2, Volume2, PenTool, Pause, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useSocket } from '../../context/SocketContext';
import BrandMark from '../../components/common/BrandMark';
import './DoctorDashboard.css';

const DoctorDashboard = () => {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [queue, setQueue] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingPause, setTogglingPause] = useState(false);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await api.get('/queue/active');
      if (res.data?.success) {
        setQueue(res.data.queue);
        setTokens(res.data.tokens);
      }
    } catch (error) {
      console.error('Failed to fetch queue', error);
      toast.error('Could not load active queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  useEffect(() => {
    if (!socket || !queue?._id) return;

    socket.emit('join_queue_room', queue._id);

    const refreshQueue = () => fetchQueue();
    const queueEvents = [
      'queue:joined',
      'queue:token_called',
      'queue:token_completed',
      'queue:status_changed',
    ];

    queueEvents.forEach((eventName) => socket.on(eventName, refreshQueue));

    return () => {
      queueEvents.forEach((eventName) => socket.off(eventName, refreshQueue));
    };
  }, [socket, queue?._id]);

  const handleCallToken = async (tokenId, number) => {
    try {
      await api.post(`/queue/tokens/${tokenId}/call`);
      toast.success(`Token #${number} called via hospital speakers!`);
      setTokens(tokens.map((token) => (token._id === tokenId ? { ...token, status: 'CALLED' } : token)));
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to call token.');
    }
  };

  const handleMarkMissed = async (tokenId) => {
    try {
      await api.post(`/queue/tokens/${tokenId}/complete`, { status: 'MISSED' });
      toast('Patient marked as skipped.', { icon: '⏭️' });
      fetchQueue();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update token.');
    }
  };

  const handleTogglePause = async () => {
    if (!queue?._id) return;

    try {
      setTogglingPause(true);
      await api.post(`/queue/${queue._id}/status`, { isPaused: !queue.isPaused });
      toast.success(queue.isPaused ? 'Queue resumed.' : 'Queue paused.');
      fetchQueue();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to change queue status.');
    } finally {
      setTogglingPause(false);
    }
  };

  return (
    <div className="doc-dashboard-container">
      <div className="doc-sidebar">
        <div className="doc-brand">
          <BrandMark />
        </div>

        <div className="doc-profile">
          <div className="doc-avatar-large">
            {user?.name ? user.name.replace('Dr. ', '').charAt(0) : 'D'}
          </div>
          <h2>Dr. {user?.name || 'Doctor'}</h2>
          <p>{user?.specialization || 'General'} • {user?.department || 'OPD'}</p>
        </div>

        <div className="doc-nav">
          <div className="doc-nav-item active"><Users size={20} /> Today's Queue</div>
          <div className="doc-nav-item opacity-50 cursor-not-allowed"><Clock size={20} /> History</div>
          <div className="doc-nav-item opacity-50 cursor-not-allowed"><Settings size={20} /> Settings</div>
        </div>

        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="btn text-slate-500 hover:bg-slate-100 w-full justify-start mt-auto"
        >
          <LogOut size={20} /> Logout
        </button>
      </div>

      <div className="doc-main">
        <div className="doc-header">
          <div>
            <h1>Waiting Room</h1>
            <p className="text-slate-500">
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-500">Queue Status:</span>
            <div className={`px-4 py-2 rounded-full text-sm font-bold ${queue?.isPaused ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {queue?.isPaused ? 'PAUSED' : 'ACTIVE'}
            </div>
            <button
              onClick={handleTogglePause}
              disabled={togglingPause || !queue?._id}
              className="btn bg-slate-100 text-slate-700"
            >
              {queue?.isPaused ? <><Play size={16} /> Resume</> : <><Pause size={16} /> Pause</>}
            </button>
          </div>
        </div>

        <div className="queue-stats-container">
          <div className="queue-stat">
            <div className="queue-stat-icon bg-blue-100 text-blue-600"><Users size={24} /></div>
            <div>
              <div className="text-2xl font-bold">{tokens.filter((token) => token.status === 'WAITING').length}</div>
              <div className="text-sm text-slate-500 font-medium">Waiting Patients</div>
            </div>
          </div>
          <div className="queue-stat">
            <div className="queue-stat-icon bg-emerald-100 text-emerald-600"><CheckCircle2 size={24} /></div>
            <div>
              <div className="text-2xl font-bold">{tokens.filter((token) => token.status === 'SERVED').length}</div>
              <div className="text-sm text-slate-500 font-medium">Served Today</div>
            </div>
          </div>
        </div>

        <div className="queue-sheet">
          <div className="queue-sheet-header">
            <div>Token</div>
            <div>Patient Details</div>
            <div>Status</div>
            <div className="text-right">Actions</div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 animate-pulse">Loading live queue...</div>
          ) : tokens.length === 0 ? (
            <div className="p-12 text-center text-slate-500">No patients in queue yet.</div>
          ) : (
            tokens.map((token) => (
              <div key={token._id} className="queue-token-row">
                <div className="token-number">#{token.number}</div>
                <div>
                  <div className="font-semibold text-slate-800">{token.patientId?.name || 'Unknown Patient'}</div>
                  <div className="text-xs text-slate-500">
                    {token.patientId?.age || '?'} yrs • {token.patientId?.gender || 'U'}
                  </div>
                </div>
                <div>
                  <span className={`token-status status-${token.status}`}>{token.status}</span>
                </div>
                <div className="flex justify-end gap-2">
                  {token.status === 'WAITING' && (
                    <button
                      onClick={() => handleCallToken(token._id, token.number)}
                      className="btn bg-blue-50 text-blue-600 hover:bg-blue-100"
                      style={{ padding: '0.4rem 0.6rem' }}
                      title="Call via Speakers"
                    >
                      <Volume2 size={18} />
                    </button>
                  )}

                  {['WAITING', 'CALLED'].includes(token.status) && (
                    <button
                      onClick={() => navigate(`/canvas/${token._id}`)}
                      className="btn btn-primary"
                      style={{ padding: '0.4rem 0.6rem' }}
                      title="Write Digital Prescription"
                    >
                      <PenTool size={18} />
                    </button>
                  )}

                  {['WAITING', 'CALLED'].includes(token.status) && (
                    <button
                      onClick={() => handleMarkMissed(token._id)}
                      className="btn bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold"
                      style={{ padding: '0.4rem 0.6rem' }}
                    >
                      Skip
                    </button>
                  )}

                  {token.status === 'SERVED' && (
                    <span className="text-sm text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 size={16} /> Done
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;
