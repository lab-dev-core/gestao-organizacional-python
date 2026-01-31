import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';

// Layout
import DashboardLayout from './components/layout/DashboardLayout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import UsersPage from './pages/Users';
import DocumentsPage from './pages/Documents';
import VideosPage from './pages/Videos';
import AcompanhamentosPage from './pages/Acompanhamentos';
import LocationsPage from './pages/Locations';
import FunctionsPage from './pages/Functions';
import FormativeStagesPage from './pages/FormativeStages';
import StageCyclesPage from './pages/StageCycles';
import UserJourneyPage from './pages/UserJourney';
import AuditLogsPage from './pages/AuditLogs';
import ProfilePage from './pages/Profile';
import TenantsPage from './pages/Tenants';

import './App.css';

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected Routes */}
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/documents" element={<DocumentsPage />} />
                <Route path="/videos" element={<VideosPage />} />
                <Route path="/acompanhamentos" element={<AcompanhamentosPage />} />
                <Route path="/locations" element={<LocationsPage />} />
                <Route path="/functions" element={<FunctionsPage />} />
                <Route path="/formative-stages" element={<FormativeStagesPage />} />
                <Route path="/stage-cycles" element={<StageCyclesPage />} />
                <Route path="/user-journey" element={<UserJourneyPage />} />
                <Route path="/audit-logs" element={<AuditLogsPage />} />
                <Route path="/tenants" element={<TenantsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<ProfilePage />} />
              </Route>

              {/* Redirects */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
