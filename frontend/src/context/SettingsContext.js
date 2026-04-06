import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.data.settings);
    } catch {
      // Server might not be ready yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchSettings();
    else setLoading(false);
  }, [user, fetchSettings]);

  // Listen for real-time setting changes
  useEffect(() => {
    if (!user) return;
    const { getSocket } = require('../services/socket');
    const socket = getSocket();
    if (!socket) return;

    const onRushMode = (data) => {
      setSettings(prev => prev ? { ...prev, rushMode: { ...prev.rushMode, enabled: data.enabled } } : prev);
    };
    const onTestMode = (data) => {
      setSettings(prev => prev ? { ...prev, testMode: { ...prev.testMode, enabled: data.enabled } } : prev);
    };
    const onUIMode = (data) => {
      setSettings(prev => prev ? { ...prev, uiMode: data.mode } : prev);
    };

    socket.on('settings:rushMode', onRushMode);
    socket.on('settings:testMode', onTestMode);
    socket.on('settings:uiMode', onUIMode);

    return () => {
      socket.off('settings:rushMode', onRushMode);
      socket.off('settings:testMode', onTestMode);
      socket.off('settings:uiMode', onUIMode);
    };
  }, [user]);

  const isRushMode = settings?.rushMode?.enabled || false;
  const isTestMode = settings?.testMode?.enabled || false;
  const uiMode = settings?.uiMode || 'advanced';
  const isBeginner = uiMode === 'beginner';

  return (
    <SettingsContext.Provider value={{
      settings, loading, fetchSettings,
      isRushMode, isTestMode, uiMode, isBeginner,
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
};
