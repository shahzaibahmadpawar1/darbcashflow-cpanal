import { useState, useEffect } from 'react';
import api from '../services/api';

export interface User {
  id: string;
  employeeId: string;
  name: string;
  role: 'SM' | 'AM' | 'Admin';
  stationId?: string | null;
  areaManagerId?: string | null;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to parse stored user', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }

    setLoading(false);
  }, []);

  const login = async (name: string, password: string) => {
    const response = await api.post('/api/auth/login', { name, password });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'Admin';
  // Role checks (not including admin in SM/AM checks for dashboard display)
  const isSM = user?.role === 'SM';
  const isAM = user?.role === 'AM';
  // Permission checks (admin has all permissions)
  const canManageStation = user?.role === 'SM' || isAdmin;
  const canManageArea = user?.role === 'AM' || isAdmin;

  return {
    user,
    loading,
    login,
    logout,
    isAuthenticated,
    isAdmin,
    isSM,
    isAM,
    canManageStation,
    canManageArea,
  };
};
