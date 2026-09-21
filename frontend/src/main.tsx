import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { pulihkanAmbang } from './domain/thresholds';
import './styles/tokens.css';
import './styles/app.css';

// Ambang yang pernah diubah operator dipasang kembali sebelum apa pun dirender.
// Mesin simulasi dibangun pada render pertama dan menilai cuplikan pertamanya
// seketika; ambang yang dipulihkan sesudah itu akan membuat cuplikan pertama
// dinilai dengan ambang yang bukan milik penggunanya.
pulihkanAmbang();

const container = document.getElementById('root');
if (!container) throw new Error('Element #root not found in index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
