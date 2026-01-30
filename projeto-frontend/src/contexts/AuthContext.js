import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
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
      if (userData.tenant) {
        setTenant(userData.tenant);
      }
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
      if (response.data.tenant) {
        setTenant(response.data.tenant);
      }
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

  const login = async (email, password, tenantSlug = null) => {
    try {
      setError(null);
      const payload = { email, password };
      if (tenantSlug) {
        payload.tenant_slug = tenantSlug;
      }

      const response = await axios.post(`${API_URL}/auth/login`, payload);
      const { access_token, refresh_token, user: userData } = response.data;

      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      if (tenantSlug) {
        localStorage.setItem('tenant_slug', tenantSlug);
      }
      setUser(userData);
      if (userData.tenant) {
        setTenant(userData.tenant);
      }

      return userData;
    } catch (err) {
      const message = err.response?.data?.detail || 'Login failed';
      setError(message);
      throw new Error(message);
    }
  };

  const register = async (userData, tenantSlug = null) => {
    try {
      setError(null);
      const url = tenantSlug
        ? `${API_URL}/auth/register?tenant_slug=${tenantSlug}`
        : `${API_URL}/auth/register`;

      const response = await axios.post(url, userData);
      const { access_token, refresh_token, user: newUser } = response.data;

      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      if (tenantSlug) {
        localStorage.setItem('tenant_slug', tenantSlug);
      }
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
    localStorage.removeItem('tenant_slug');
    setUser(null);
    setTenant(null);
  };

  const updateUser = (updatedData) => {
    setUser(prev => ({ ...prev, ...updatedData }));
  };

  const getTenantBySlug = async (slug) => {
    try {
      const response = await axios.get(`${API_URL}/tenants/slug/${slug}`);
      return response.data;
    } catch (err) {
      return null;
    }
  };

  const isSuperAdmin = user?.role === 'superadmin';
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isFormador = user?.role === 'formador';
  const isUser = user?.role === 'user';
  const isTenantOwner = user?.is_tenant_owner === true;

  const value = {
    user,
    tenant,
    loading,
    error,
    login,
    register,
    logout,
    updateUser,
    getAuthHeaders,
    refreshToken,
    getTenantBySlug,
    isSuperAdmin,
    isAdmin,
    isFormador,
    isUser,
    isTenantOwner,
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
