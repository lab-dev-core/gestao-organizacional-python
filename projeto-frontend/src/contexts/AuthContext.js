import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const refreshToken = useCallback(async () => {
    try {
      const refreshTokenValue = localStorage.getItem('refresh_token');
      if (!refreshTokenValue) {
        throw new Error('No refresh token');
      }

      const response = await axios.post(`${API_URL}/auth/refresh`, {
        refresh_token: refreshTokenValue
      });

      const { access_token, refresh_token, user: userData } = response.data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      setUser(userData);
      return access_token;
    } catch (err) {
      logout();
      throw err;
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setUser(response.data);
    } catch (err) {
      if (err.response?.status === 401) {
        try {
          await refreshToken();
        } catch {
          logout();
        }
      } else {
        logout();
      }
    } finally {
      setLoading(false);
    }
  }, [refreshToken]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    try {
      setError(null);
      const response = await axios.post(`${API_URL}/auth/login`, { email, password });
      const { access_token, refresh_token, user: userData } = response.data;

      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      setUser(userData);

      return userData;
    } catch (err) {
      const message = err.response?.data?.detail || 'Login failed';
      setError(message);
      throw new Error(message);
    }
  };

  const register = async (userData) => {
    try {
      setError(null);
      const response = await axios.post(`${API_URL}/auth/register`, userData);
      const { access_token, refresh_token, user: newUser } = response.data;

      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      setUser(newUser);

      return newUser;
    } catch (err) {
      const message = err.response?.data?.detail || 'Registration failed';
      setError(message);
      throw new Error(message);
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  const updateUser = (updatedData) => {
    setUser(prev => ({ ...prev, ...updatedData }));
  };

  const isAdmin = user?.role === 'admin';
  const isFormador = user?.role === 'formador';
  const isUser = user?.role === 'user';

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    updateUser,
    getAuthHeaders,
    refreshToken,
    isAdmin,
    isFormador,
    isUser,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
