import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/Landing';
import { NewJobPage } from './pages/NewJob';
import { JobDetailPage } from './pages/JobDetail';
import { RouteExplorerPage } from './pages/RouteExplorer';
import { WireframePreviewPage } from './pages/WireframePreview';
import { ExportCenterPage } from './pages/ExportCenter';
import { SettingsPage } from './pages/Settings';
import { FigmaSyncPage } from './pages/FigmaSync';
import { ErrorInspectorPage } from './pages/ErrorInspector';
import { DashboardPage } from './pages/Dashboard';
import { ThemeProvider } from './hooks/useTheme';

export function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/jobs/new" element={<NewJobPage />} />
          <Route path="/jobs/:id" element={<JobDetailPage />} />
          <Route path="/jobs/:id/routes" element={<RouteExplorerPage />} />
          <Route path="/jobs/:id/wireframe" element={<WireframePreviewPage />} />
          <Route path="/jobs/:id/export" element={<ExportCenterPage />} />
          <Route path="/jobs/:id/errors" element={<ErrorInspectorPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/figma" element={<FigmaSyncPage />} />
        </Route>
      </Routes>
    </ThemeProvider>
  );
}
