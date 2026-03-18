import { useState, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import TN3270Terminal from './components/TN3270Terminal';
import OrderModelScreen from './components/OrderModelScreen';
import UketsukePage from './components/UketsukePage';
import TehaiKidoPage from './components/TehaiKidoPage';

/**
 * Routing:
 *   /                -> Terminal + Order Model
 *   /uketsuke.index  -> Uketsuke (受付) page
 *   /tehai.index     -> Tehai Kido (手配起動) page
 */
function App() {
  const [showOrder, setShowOrder] = useState(false);
  const [currentScreenLines, setCurrentScreenLines] = useState([]);

  const handleScreenUpdate = useCallback((lines) => {
    setCurrentScreenLines(lines);
  }, []);

  const TerminalView = () => (
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

  return (
    <Routes>
      <Route path="/" element={<TerminalView />} />
      <Route path="/uketsuke.index" element={<UketsukePage />} />
      <Route path="/tehai.index" element={<TehaiKidoPage />} />
    </Routes>
  );
}

export default App;
