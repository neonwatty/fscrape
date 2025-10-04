import { createRoot } from 'react-dom/client';

function Sidebar() {
  return (
    <div style={{ padding: '20px' }}>
      <h2>fscrape Dashboard</h2>
      <p>Visualizations coming soon...</p>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<Sidebar />);
}
