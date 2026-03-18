import { useState, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import TN3270Terminal from './components/TN3270Terminal';
import OrderModelScreen from './components/OrderModelScreen';
import PocPage from './components/PocPage';

/**
 * Main App with routing:
 *   /           -> Terminal + Order Model (existing)
 *   /poc.index  -> POC automation page (new)
 */
function App() {
  // --- Terminal + Order state ---
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
          onSave={(data) => {
            console.log('Order save data:', data);
            alert('Save data logged to console.');
          }}
        />
      )}
    </div>
  );

  return (
    <Routes>
      <Route path="/" element={<TerminalView />} />
      <Route path="/poc.index" element={<PocPage />} />
    </Routes>
  );
}

export default App;
