/**
 * Sidebar Main Component with Tab Navigation
 */

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { LibraryView } from './components/LibraryView';
import './styles.css';

type TabType = 'analytics' | 'library';

function Sidebar() {
  const [activeTab, setActiveTab] = useState<TabType>('analytics');

  const handleRefresh = () => {
    // Could add global refresh logic here if needed
  };

  return (
    <div className="sidebar-container">
      {/* Header with Tab Navigation */}
      <div className="sidebar-header">
        <div>
          <h1 className="sidebar-title">📊 fscrape</h1>
          <p className="sidebar-subtitle">
            Reddit Analytics & Library
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📈 Analytics
        </button>
        <button
          className={`tab-btn ${activeTab === 'library' ? 'active' : ''}`}
          onClick={() => setActiveTab('library')}
        >
          📚 Library
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'analytics' ? (
          <AnalyticsDashboard onRefresh={handleRefresh} />
        ) : (
          <LibraryView onRefresh={handleRefresh} />
        )}
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<Sidebar />);
}
