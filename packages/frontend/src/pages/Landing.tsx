import { useNavigate } from 'react-router-dom';
import { Layers, ArrowRight, Github, FileArchive } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export function LandingPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 h-16 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold">RepoFrame Studio</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleTheme} className="btn-ghost text-xs">
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button onClick={() => navigate('/dashboard')} className="btn-secondary text-sm">
            Dashboard
          </button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-2xl text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
            Generate wireframes from any codebase
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Turn repos into
            <span className="text-brand-600 dark:text-brand-400"> editable wireframes</span>
          </h1>

          <p className="text-lg text-[var(--color-text-secondary)] max-w-lg mx-auto">
            Paste a GitHub URL or upload a ZIP. RepoFrame clones, builds, renders, and extracts 
            structured wireframes ready for design tools.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              onClick={() => navigate('/jobs/new')}
              className="btn-primary px-6 py-3 text-base"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-secondary px-6 py-3 text-base"
            >
              View Jobs
            </button>
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-20 max-w-3xl w-full">
          <div className="card text-center space-y-2">
            <Github className="w-8 h-8 mx-auto text-[var(--color-text-secondary)]" />
            <h3 className="font-medium text-sm">GitHub Import</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Clone any public repo with branch selection
            </p>
          </div>
          <div className="card text-center space-y-2">
            <FileArchive className="w-8 h-8 mx-auto text-[var(--color-text-secondary)]" />
            <h3 className="font-medium text-sm">ZIP Upload</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Drag & drop your project archive
            </p>
          </div>
          <div className="card text-center space-y-2">
            <Layers className="w-8 h-8 mx-auto text-[var(--color-text-secondary)]" />
            <h3 className="font-medium text-sm">Wireframe Export</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Low-fi and high-fi modes with Figma export
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
