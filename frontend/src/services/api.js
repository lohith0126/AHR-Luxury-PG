import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || '';

const http = axios.create({ baseURL: `${API_BASE}/api`, timeout: 20000 });

const data = (response) => response.data;

/** Turns any failed request into a message that is safe to show to the owner. */
export const getErrorMessage = (err, fallback = 'Something went wrong. Please try again.') => {
  if (err.response) {
    const message = err.response.data?.message;
    return message && err.response.status < 500 ? message : fallback;
  }
  if (err.request) return 'Unable to reach the server. Check your connection and try again.';
  return fallback;
};

export const getFieldErrors = (err) => err.response?.data?.errors || {};

// Photos and ID proofs are served by per-customer API routes (there is no public /uploads folder).
// `version` (e.g. the customer's updatedAt) makes the browser reload the image after a replacement.
export const profilePhotoUrl = (customerId, version = '') =>
  `${API_BASE}/api/customers/${customerId}/profile-photo${version ? `?v=${encodeURIComponent(version)}` : ''}`;
export const idProofUrl = (customerId, version = '') =>
  `${API_BASE}/api/customers/${customerId}/id-proof${version ? `?v=${encodeURIComponent(version)}` : ''}`;

// Dashboard & blocks
export const fetchDashboard = () => http.get('/dashboard').then(data);
export const fetchBlocks = () => http.get('/blocks').then(data);
export const fetchBlock = (id) => http.get(`/blocks/${id}`).then(data);

// Rooms
export const fetchRooms = (blockId) => http.get(`/blocks/${blockId}/rooms`).then(data);
export const createRoom = (blockId, payload) => http.post(`/blocks/${blockId}/rooms`, payload).then(data);
export const fetchRoom = (roomId) => http.get(`/rooms/${roomId}`).then(data);
export const deleteRoom = (roomId) => http.delete(`/rooms/${roomId}`).then(data);
export const fetchRoomCustomers = (roomId) => http.get(`/rooms/${roomId}/customers`).then(data);

// Customers
export const fetchCustomers = (params) => http.get('/customers', { params }).then(data);
export const fetchCustomer = (id) => http.get(`/customers/${id}`).then(data);
export const saveCustomer = (id, formData) =>
  (id ? http.put(`/customers/${id}`, formData) : http.post('/customers', formData)).then(data);
export const removeCustomer = (id) => http.delete(`/customers/${id}`).then(data);

// Payments
export const fetchMonthlyPayments = (month, blockId) =>
  http.get('/payments', { params: { month, blockId: blockId || undefined } }).then(data);
export const updatePaymentStatus = (paymentId, status) =>
  http.patch(`/payments/${paymentId}`, { status }).then(data);
export const fetchCustomerPaymentHistory = (customerId) =>
  http.get(`/customers/${customerId}/payments`).then(data);

/** Downloads a report as a Blob. blockId omitted = Overall PG. Errors keep the server's message. */
export const downloadReport = async ({ blockId, month, format }) => {
  try {
    const response = await http.get('/reports', {
      params: { blockId: blockId || undefined, month, format },
      responseType: 'blob',
      timeout: 90000, // a cold-starting Render instance can be slow on the first request
    });
    return response.data;
  } catch (err) {
    // With responseType "blob" the JSON error body arrives as a Blob - turn it back into an object.
    if (err.response?.data instanceof Blob) {
      try {
        err.response.data = JSON.parse(await err.response.data.text());
      } catch {
        err.response.data = {};
      }
    }
    throw err;
  }
};

/** Saves a Blob through the browser's normal download flow. */
export const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
