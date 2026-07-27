import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    setUser(null);
  }, []);

  const checkCurrentUser = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/me');
      setUser(res.data.user);
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error('Session check failed', error);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkCurrentUser();
  }, [checkCurrentUser]);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearSession();
    };

    window.addEventListener('docnet:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('docnet:unauthorized', handleUnauthorized);
  }, [clearSession]);

  const login = async (email, password, role) => {
    let endpoint = '';
    if (role === 'PATIENT') endpoint = '/auth/patient/login';
    if (role === 'DOCTOR') endpoint = '/auth/doctor/login';
    if (role === 'STAFF') endpoint = '/auth/staff/login';
    if (role === 'PLATFORM_ADMIN') endpoint = '/platform/login';

    const response = await api.post(endpoint, { email, password });

    await checkCurrentUser();

    return response.data;
  };

  const logout = async () => {
    try {
      const role = user?.role || 'PATIENT';
      const endpoint =
        role === 'PLATFORM_ADMIN'
          ? '/platform/logout'
          : `/auth/${role.toLowerCase()}/logout`;
      await api.post(endpoint);
    } catch (error) {
      console.error('Logout error', error);
    } finally {
      clearSession();
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    checkCurrentUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
