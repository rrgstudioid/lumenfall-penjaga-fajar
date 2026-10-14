import { createRoot } from 'react-dom/client';
import Home from '../../app/page';
import '../../app/globals.css';
// Actual application and Game loop; no fake Game, combat sink or UI callbacks.
createRoot(document.getElementById('root')!).render(<Home />);
