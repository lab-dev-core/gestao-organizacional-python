import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import ErrorBoundary from './components/ErrorBoundary';

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
import CertificatesPage from './pages/Certificates';

import './App.css';

function App() {
  return (
    <ErrorBoundary>
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
                  <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                  <Route path="/users" element={<ErrorBoundary><UsersPage /></ErrorBoundary>} />
                  <Route path="/documents" element={<ErrorBoundary><DocumentsPage /></ErrorBoundary>} />
                  <Route path="/videos" element={<ErrorBoundary><VideosPage /></ErrorBoundary>} />
                  <Route path="/acompanhamentos" element={<ErrorBoundary><AcompanhamentosPage /></ErrorBoundary>} />
                  <Route path="/locations" element={<ErrorBoundary><LocationsPage /></ErrorBoundary>} />
                  <Route path="/functions" element={<ErrorBoundary><FunctionsPage /></ErrorBoundary>} />
                  <Route path="/formative-stages" element={<ErrorBoundary><FormativeStagesPage /></ErrorBoundary>} />
                  <Route path="/stage-cycles" element={<ErrorBoundary><StageCyclesPage /></ErrorBoundary>} />
                  <Route path="/user-journey" element={<ErrorBoundary><UserJourneyPage /></ErrorBoundary>} />
                  <Route path="/audit-logs" element={<ErrorBoundary><AuditLogsPage /></ErrorBoundary>} />
                  <Route path="/tenants" element={<ErrorBoundary><TenantsPage /></ErrorBoundary>} />
                  <Route path="/certificates" element={<ErrorBoundary><CertificatesPage /></ErrorBoundary>} />
                  <Route path="/profile" element={<ErrorBoundary><ProfilePage /></ErrorBoundary>} />
                  <Route path="/settings" element={<ErrorBoundary><ProfilePage /></ErrorBoundary>} />
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
    </ErrorBoundary>
  );
}

export default App;
