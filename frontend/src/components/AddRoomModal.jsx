import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { createRoom, getErrorMessage, getFieldErrors } from '../services/api.js';
import { ROOM_TYPES } from '../utils/constants.js';

const INITIAL = { roomNumber: '', roomType: '3 in 1' };

export default function AddRoomModal({ open, blockId, blockName, onClose, onCreated }) {
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(INITIAL);
      setErrors({});
      setFormError('');
    }
  }, [open]);

  const capacity = ROOM_TYPES.find((t) => t.value === form.roomType)?.capacity;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.roomNumber.trim()) {
      setErrors({ roomNumber: 'Room number is required.' });
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const room = await createRoom(blockId, form);
      onCreated(room);
    } catch (err) {
      setErrors(getFieldErrors(err));
      setFormError(getErrorMessage(err, 'Unable to add the room. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={`Add Room · ${blockName}`} onClose={saving ? () => {} : onClose}>
      <form onSubmit={handleSubmit} noValidate className="form-stack">
        {formError && <div className="alert alert-error">{formError}</div>}

        <div className={`field ${errors.roomNumber ? 'has-error' : ''}`}>
          <label htmlFor="roomNumber">
            Room Number<span className="req">*</span>
          </label>
          <input
            id="roomNumber"
            name="roomNumber"
            value={form.roomNumber}
            onChange={handleChange}
            placeholder="e.g. 101"
            autoFocus
            maxLength={20}
          />
          {errors.roomNumber && <span className="field-error">{errors.roomNumber}</span>}
        </div>

        <div className="field">
          <label htmlFor="roomType">
            Room Type<span className="req">*</span>
          </label>
          <select id="roomType" name="roomType" value={form.roomType} onChange={handleChange}>
            {ROOM_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.value}
              </option>
            ))}
          </select>
        </div>

        <div className="capacity-readout">
          Capacity <strong>{capacity}</strong> {capacity === 1 ? 'bed' : 'beds'}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-gold" disabled={saving}>
            {saving ? 'Saving room...' : 'Add Room'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
