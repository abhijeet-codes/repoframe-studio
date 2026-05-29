import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Plus,
  Settings,
  Figma,
  Moon,
  Sun,
  Layers,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';

export function Layout() {
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-60 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 h-14 border-b border-[var(--color-border)]">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm">RepoFrame Studio</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </NavLink>
          <NavLink to="/jobs/new" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Plus className="w-4 h-4" />
            New Job
          </NavLink>
          <NavLink to="/figma" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Figma className="w-4 h-4" />
            Figma Sync
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Settings className="w-4 h-4" />
            Settings
          </NavLink>
        </nav>

        {/* Theme toggle */}
        <div className="px-3 py-3 border-t border-[var(--color-border)]">
          <button onClick={toggleTheme} className="sidebar-link w-full">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 flex items-center gap-4 px-4 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
          <button
            className="lg:hidden btn-ghost p-1"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex-1" />
          <button onClick={() => navigate('/jobs/new')} className="btn-primary text-xs">
            <Plus className="w-3.5 h-3.5" />
            New Job
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
