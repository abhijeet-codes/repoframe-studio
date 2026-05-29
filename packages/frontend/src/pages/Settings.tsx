import { useTheme } from '../hooks/useTheme';
import { Moon, Sun, Monitor } from 'lucide-react';

export function SettingsPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold">Settings</h1>

      <div className="card space-y-4">
        <h2 className="text-sm font-medium">Appearance</h2>
        <div className="flex gap-3">
          <button
            onClick={() => theme !== 'light' && toggleTheme()}
            className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
              theme === 'light' ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-[var(--color-border)]'
            }`}
          >
            <Sun className="w-5 h-5 mx-auto mb-2" />
            <p className="text-xs font-medium text-center">Light</p>
          </button>
          <button
            onClick={() => theme !== 'dark' && toggleTheme()}
            className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
              theme === 'dark' ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-[var(--color-border)]'
            }`}
          >
            <Moon className="w-5 h-5 mx-auto mb-2" />
            <p className="text-xs font-medium text-center">Dark</p>
          </button>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-medium">Pipeline Defaults</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Default Wireframe Mode</label>
            <select className="input-field" defaultValue="both">
              <option value="both">Both (Low-fi + High-fi)</option>
              <option value="low-fi">Low-fidelity only</option>
              <option value="high-fi">High-fidelity only</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Install Timeout (seconds)</label>
            <input type="number" className="input-field" defaultValue={120} />
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Build Timeout (seconds)</label>
            <input type="number" className="input-field" defaultValue={180} />
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Render Timeout (seconds)</label>
            <input type="number" className="input-field" defaultValue={60} />
          </div>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-medium">Storage</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          All data is stored locally in the <code className="text-xs bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 rounded">./data</code> directory.
        </p>
        <div className="text-xs text-[var(--color-text-tertiary)] space-y-1">
          <p>Jobs: ./data/jobs</p>
          <p>Workspaces: ./data/workspaces</p>
          <p>Artifacts: ./data/artifacts</p>
        </div>
      </div>
    </div>
  );
}
