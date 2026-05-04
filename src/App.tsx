import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { CrmStatsProvider } from './contexts/CrmStatsContext'
import { PipelineStagesProvider } from './contexts/PipelineStagesContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { EnquiryLogPage } from './pages/EnquiryLogPage'
import { PipelinePage } from './pages/PipelinePage'
import { FollowUpsPage } from './pages/FollowUpsPage'
import { TemplatesPage } from './pages/TemplatesPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <CrmStatsProvider>
                <PipelineStagesProvider>
                  <Layout />
                </PipelineStagesProvider>
              </CrmStatsProvider>
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/enquiries" replace />} />
          <Route path="/enquiries" element={<EnquiryLogPage />} />
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/follow-ups" element={<FollowUpsPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/enquiries" replace />} />
      </Routes>
    </AuthProvider>
  )
}
