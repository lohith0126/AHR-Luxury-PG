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

export const fileUrl = (filename) => `${API_BASE}/uploads/${filename}`;

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
