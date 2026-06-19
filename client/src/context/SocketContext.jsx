import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { SOCKET_URL } from '../utils/api';
import toast from 'react-hot-toast';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const socketInstance = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socketInstance.on('connect', () => {
      socketInstance.emit('join_user_room', user._id);

      if (user.role === 'STAFF' || user.role === 'DOCTOR') {
        if (user.storeId) socketInstance.emit('join_store_room', user.storeId);
      }
    });

    const handleTokenCalled = (data) => {
      const tokenNumber = data?.token?.number || data?.number || data?.tokenNumber || 'N/A';
      toast(`Your Token #${tokenNumber} was just called! Please proceed to Cabin.`, {
        icon: '📢',
        duration: 6000,
        style: { borderRadius: '10px', background: '#333', color: '#fff' },
      });
      window.dispatchEvent(new CustomEvent('docnet:refresh_patient_queue'));
    };

    socketInstance.on('token:called', handleTokenCalled);

    socketInstance.on('token:canceled', () => {
      window.dispatchEvent(new CustomEvent('docnet:refresh_patient_queue'));
    });

    socketInstance.on('token:missed', (data) => {
      const tokenNumber = data?.tokenNumber || 'N/A';
      toast.error(`Your Token #${tokenNumber} was marked MISSED.`);
      window.dispatchEvent(new CustomEvent('docnet:refresh_patient_queue'));
    });

    socketInstance.on('token:prescription_ready', (data) => {
      toast.success(
        `New Digital Prescription from Dr. ${data.doctorName || 'your doctor'} is ready!`,
        { duration: 6000 }
      );
      window.dispatchEvent(new CustomEvent('docnet:refresh_patient_history'));
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
      setSocket(null);
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
