/**
 * API configuration
 * 
 * Change API_BASE to match your Spring Boot backend address:
 * - Local development: http://localhost:8080/api/tn3270
 * - Fargate/ALB:       http://<ALB-DNS>/api/tn3270
 */
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8080/api/tn3270';

export default API_BASE;
