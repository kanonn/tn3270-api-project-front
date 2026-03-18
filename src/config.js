/**
 * API and POC configuration
 */
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8080/api/tn3270';

/** POC automation settings */
const POC_CONFIG = {
  username: process.env.REACT_APP_POC_USERNAME || 'CKJ00009',
  password: process.env.REACT_APP_POC_PASSWORD || 'PASS01',
  /** Delay between 3270 operations in milliseconds */
  operationDelay: parseInt(process.env.REACT_APP_OPERATION_DELAY || '1000', 10),
  /** Max retries for connect step */
  connectRetries: 3,
};

export { POC_CONFIG };
export default API_BASE;
