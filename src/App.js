import { useState, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import TN3270Terminal from './components/TN3270Terminal';
import OrderModelScreen from './components/OrderModelScreen';
import UketsukePage from './components/UketsukePage';
import TehaiKidoPage from './components/TehaiKidoPage';

/**
 * Routing:
 *   /                -> Terminal + Order Model
 *   /uketsuke.index  -> Uketsuke page
 *   /tehai.index     -> Tehai Kido page
 *
 * IMPORTANT: The terminal view is rendered directly in the Route element,
 * NOT as a nested function component. Defining it as a function inside App
 * causes React to unmount/remount on every re-render, losing connection state.
 */
function TerminalPage() {
  const [showOrder, setShowOrder] = useState(false);
  const [currentScreenLines, setCurrentScreenLines] = useState([]);

  const handleScreenUpdate = useCallback((lines) => {
    setCurrentScreenLines(lines);
  }, []);

  return (
    <div>
      <div style={{ display: showOrder ? 'none' : 'block' }}>
        <TN3270Terminal
          onOpenOrderModel={() => setShowOrder(true)}
          onScreenUpdate={handleScreenUpdate}
        />
      </div>
      {showOrder && (
        <OrderModelScreen
          screenLines={currentScreenLines}
          onBack={() => setShowOrder(false)}
          onSave={(data) => { console.log('Order save:', data); alert('Logged.'); }}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<TerminalPage />} />
      <Route path="/uketsuke.index" element={<UketsukePage />} />
      <Route path="/tehai.index" element={<TehaiKidoPage />} />
    </Routes>
  );
}

export default App;
