import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('pos_token');
    const savedUser = localStorage.getItem('pos_user');
    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(parsedUser);
        connectSocket();
        // Validate token with backend (non-blocking)
        api.get('/auth/me').then(({ data }) => {
          setUser(data.user);
          localStorage.setItem('pos_user', JSON.stringify(data.user));
        }).catch((err) => {
          // Only clear auth for actual 401 errors, not network failures
          if (err.response?.status === 401) {
            setUser(null);
            setToken(null);
            localStorage.removeItem('pos_token');
            localStorage.removeItem('pos_user');
            disconnectSocket();
          }
          // Network errors: keep cached auth — server might be starting up
        });
      } catch {
        localStorage.removeItem('pos_token');
        localStorage.removeItem('pos_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('pos_token', data.token);
    localStorage.setItem('pos_user', JSON.stringify(data.user));
    connectSocket();
    return data;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
    disconnectSocket();
  };

  const hasRole = (...roles) => {
    return user && roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
