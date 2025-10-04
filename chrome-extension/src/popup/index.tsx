import { createRoot } from 'react-dom/client';

function Popup() {
  return (
    <div style={{ padding: '20px', minWidth: '300px' }}>
      <h2>fscrape</h2>
      <p>Popup UI coming soon...</p>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<Popup />);
}
