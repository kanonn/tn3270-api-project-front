import { useState } from 'react';
import TN3270Terminal from './components/TN3270Terminal';
import OrderModelScreen from './components/OrderModelScreen';

/**
 * Main App with screen navigation.
 * Terminal screen is the default; Order Model is opened via button.
 * The 3270 session and screen data are shared between screens.
 */
function App() {
  const [currentScreen, setCurrentScreen] = useState('terminal');
  const [sharedScreenLines, setSharedScreenLines] = useState([]);
  const [sharedSessionId, setSharedSessionId] = useState(null);

  const openOrderModel = (screenLines, sessionId) => {
    setSharedScreenLines(screenLines);
    setSharedSessionId(sessionId);
    setCurrentScreen('order');
  };

  const backToTerminal = () => {
    setCurrentScreen('terminal');
  };

  const handleOrderSave = (data) => {
    console.log('Order save data:', data);
    // Future: send edited data back to 3270 via staged inputs
    alert('Save data logged to console. (Send-back logic not yet implemented)');
  };

  if (currentScreen === 'order') {
    return (
      <OrderModelScreen
        screenLines={sharedScreenLines}
        sessionId={sharedSessionId}
        onBack={backToTerminal}
        onSave={handleOrderSave}
      />
    );
  }

  return (
    <TN3270Terminal
      onOpenOrderModel={openOrderModel}
    />
  );
}

export default App;
