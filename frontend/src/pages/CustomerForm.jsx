import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Icon from '../components/Icon.jsx';
import Loader from '../components/Loader.jsx';
import ProfilePhotoField from '../components/ProfilePhotoField.jsx';
import { useToast } from '../components/Toast.jsx';
import {
  fetchBlocks,
  fetchCustomer,
  fetchRoom,
  fetchRooms,
  getErrorMessage,
  getFieldErrors,
  idProofUrl,
  profilePhotoUrl,
  saveCustomer,
} from '../services/api.js';
import { ID_PROOF_TYPES, MONTH_NAMES, SHARING_TYPES } from '../utils/constants.js';
import { compressImage } from '../utils/imageCompress.js';
import { formatBillingMonth, toInputDate, todayInputDate } from '../utils/format.js';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_REGEX = /^(?:\+91|91|0)?[6-9]\d{9}$/;

const emptyForm = () => ({
  fullName: '',
  mobile: '',
  email: '',
  blockId: '',
  roomId: '',
  sharingType: '',
  dateOfJoining: todayInputDate(),
  expectedCheckoutDate: '',
  idProofType: '',
  idNumber: '',
  monthlyRent: '',
  securityDeposit: '',
});

function Field({ label, required, error, hint, children }) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label>
        {label}
        {required && <span className="req">*</span>}
      </label>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

/** Frontend validation for quick feedback. The backend re-validates everything. */
const validate = (form, hasIdFile, selectedRoom, originalRoomId) => {
  const errors = {};
  if (!form.fullName.trim()) errors.fullName = 'Full name is required.';
  if (!form.mobile.trim()) errors.mobile = 'Mobile number is required.';
  else if (!MOBILE_REGEX.test(form.mobile.replace(/[\s-]/g, ''))) {
    errors.mobile = 'Enter a valid 10-digit mobile number.';
  }
  if (form.email.trim() && !EMAIL_REGEX.test(form.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (!form.blockId) errors.blockId = 'Select a building.';
  if (!form.roomId) errors.roomId = 'Select a room.';
  else if (selectedRoom && selectedRoom.available === 0 && selectedRoom._id !== originalRoomId) {
    errors.roomId = 'Room is already full.';
  }
  if (!form.sharingType) errors.sharingType = 'Select a sharing type.';
  else if (selectedRoom && form.sharingType !== `${selectedRoom.capacity} Sharing`) {
    errors.sharingType = `A ${selectedRoom.roomType} room only supports ${selectedRoom.capacity} Sharing.`;
  }
  if (!form.dateOfJoining) errors.dateOfJoining = 'Date of joining is required.';
  if (form.expectedCheckoutDate && form.dateOfJoining && form.expectedCheckoutDate < form.dateOfJoining) {
    errors.expectedCheckoutDate = 'Check-out date cannot be before the joining date.';
  }
  if (!form.idProofType) errors.idProofType = 'Select an ID proof type.';
  const compactId = form.idNumber.replace(/\s/g, '');
  if (!compactId) errors.idNumber = 'ID number is required.';
  else if (form.idProofType === 'Aadhaar Card' && !/^\d{12}$/.test(compactId)) {
    errors.idNumber = 'Aadhaar number must be 12 digits.';
  }
  if (!hasIdFile) errors.idProofFile = 'Upload the ID proof.';

  const rent = Number(form.monthlyRent);
  if (!form.monthlyRent) errors.monthlyRent = 'Monthly rent is required.';
  else if (!Number.isFinite(rent) || rent <= 0) errors.monthlyRent = 'Monthly rent must be greater than zero.';
  if (form.securityDeposit) {
    const deposit = Number(form.securityDeposit);
    if (!Number.isFinite(deposit) || deposit < 0) errors.securityDeposit = 'Enter a valid deposit amount.';
  }

  return errors;
};

export default function CustomerForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [searchParams] = useSearchParams();
  const presetRoomId = searchParams.get('roomId');
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [blocks, setBlocks] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  const [idFile, setIdFile] = useState(null);
  const [idPreviewUrl, setIdPreviewUrl] = useState('');
  const [existingIdProof, setExistingIdProof] = useState(null); // { available, contentType } of the saved document
  const [rentSummary, setRentSummary] = useState(null);

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [hasExistingPhoto, setHasExistingPhoto] = useState(false);

  const [originalRoomId, setOriginalRoomId] = useState('');

  const [loadError, setLoadError] = useState('');
  const [loaded, setLoaded] = useState(!isEdit);

  // Buildings
  useEffect(() => {
    fetchBlocks()
      .then(setBlocks)
      .catch((err) => setLoadError(getErrorMessage(err)));
  }, []);

  // Existing customer (edit mode)
  useEffect(() => {
    if (!isEdit) return;
    fetchCustomer(id)
      .then((c) => {
        if (c.status !== 'Active') {
          setLoadError('Checked-out customers cannot be edited.');
          return;
        }
        setForm({
          fullName: c.fullName,
          mobile: c.mobile,
          email: c.email || '',
          blockId: c.blockId._id,
          roomId: c.roomId._id,
          sharingType: c.sharingType,
          dateOfJoining: toInputDate(c.dateOfJoining),
          expectedCheckoutDate: toInputDate(c.expectedCheckoutDate),
          idProofType: c.idProofType,
          idNumber: c.idNumber,
          monthlyRent: String(c.monthlyRent ?? ''),
          securityDeposit: String(c.securityDeposit ?? ''),
        });
        setExistingIdProof(c.idProofMeta || { available: false });
        setRentSummary(c.rentSummary || null);
        setHasExistingPhoto(Boolean(c.profilePhoto && c.profilePhotoAvailable));
        setOriginalRoomId(c.roomId._id);
        setLoaded(true);
      })
      .catch((err) => setLoadError(getErrorMessage(err)));
  }, [id, isEdit]);

  // Pre-select the room when arriving from a Room page
  useEffect(() => {
    if (isEdit || !presetRoomId) return;
    fetchRoom(presetRoomId)
      .then((room) =>
        setForm((prev) => ({
          ...prev,
          blockId: room.blockId._id,
          roomId: room._id,
          sharingType: `${room.capacity} Sharing`,
        }))
      )
      .catch((err) => setLoadError(getErrorMessage(err)));
  }, [isEdit, presetRoomId]);

  // Rooms of the selected building
  useEffect(() => {
    if (!form.blockId) {
      setRooms([]);
      return undefined;
    }
    let cancelled = false;
    setRoomsLoading(true);
    fetchRooms(form.blockId)
      .then((data) => {
        if (!cancelled) setRooms(data);
      })
      .catch(() => {
        if (!cancelled) {
          setRooms([]);
          setFormError('Unable to load rooms for this building.');
        }
      })
      .finally(() => {
        if (!cancelled) setRoomsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.blockId]);

  // Preview for a newly picked/captured profile photo
  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  // Preview for a newly picked ID proof image (not shown for PDFs)
  useEffect(() => {
    if (!idFile || !idFile.type.startsWith('image/')) {
      setIdPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(idFile);
    setIdPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [idFile]);

  const selectedRoom = rooms.find((room) => room._id === form.roomId);

  const clearError = (name) => setErrors((prev) => ({ ...prev, [name]: '' }));

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'blockId') {
        next.roomId = '';
        next.sharingType = '';
      }
      if (name === 'roomId') {
        const room = rooms.find((r) => r._id === value);
        next.sharingType = room ? `${room.capacity} Sharing` : '';
      }
      return next;
    });
    clearError(name);
    if (name === 'blockId' || name === 'roomId') clearError('sharingType');
  };

  const handlePhotoChange = (file, errorMessage) => {
    if (errorMessage) {
      setErrors((prev) => ({ ...prev, profilePhoto: errorMessage }));
      return;
    }
    setPhotoFile(file);
    clearError('profilePhoto');
  };

  const handleIdFile = async (event) => {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (!picked) return;
    if (!ALLOWED_FILE_TYPES.includes(picked.type)) {
      setErrors((prev) => ({ ...prev, idProofFile: 'Upload a JPG, PNG, WEBP image or a PDF.' }));
      return;
    }
    const prepared = await compressImage(picked, { maxSide: 1800, quality: 0.85 }); // PDFs pass through untouched
    if (prepared.size > MAX_FILE_BYTES) {
      setErrors((prev) => ({ ...prev, idProofFile: 'File is too large. Maximum size is 5 MB.' }));
      return;
    }
    setIdFile(prepared);
    clearError('idProofFile');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setFormError('');

    const found = validate(form, Boolean(idFile || existingIdProof?.available), selectedRoom, originalRoomId);
    if (Object.keys(found).length) {
      setErrors(found);
      setFormError('Please correct the highlighted fields.');
      return;
    }

    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => payload.append(key, value));
    if (idFile) payload.append('idProofFile', idFile);
    if (photoFile) payload.append('profilePhoto', photoFile);

    setSaving(true);
    try {
      const customer = await saveCustomer(id, payload);
      showToast(isEdit ? 'Customer updated successfully.' : 'Customer added successfully.');
      navigate(isEdit ? `/customers/${customer._id}` : `/rooms/${customer.roomId._id}`, { replace: true });
    } catch (err) {
      setErrors(getFieldErrors(err));
      setFormError(getErrorMessage(err, 'Unable to save customer. Please try again.'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  if (loadError) return <ErrorState message={loadError} onRetry={() => navigate(-1)} />;
  if (!loaded) return <Loader text="Loading customer..." />;

  const hasSavedId = Boolean(existingIdProof?.available);
  const existingIdIsPdf = existingIdProof?.contentType === 'application/pdf';
  const nextMonthLabel = (() => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return formatBillingMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`, MONTH_NAMES);
  })();
  const currentPhotoPreview = photoPreviewUrl || (hasExistingPhoto ? profilePhotoUrl(id) : '');

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: 'Customers', to: '/customers' },
          { label: isEdit ? 'Edit Customer' : 'Add Customer' },
        ]}
      />
      <h1 className="page-title">Add / Edit Customer</h1>

      <form onSubmit={handleSubmit} noValidate className="customer-form">
        {formError && (
          <div className="alert alert-error" role="alert">
            {formError}
          </div>
        )}

        <section className="card form-section">
          <h2>Personal Information</h2>
          <ProfilePhotoField
            previewUrl={currentPhotoPreview}
            fallbackName={form.fullName}
            error={errors.profilePhoto}
            onChange={handlePhotoChange}
          />
          <Field label="Full Name" required error={errors.fullName}>
            <input name="fullName" value={form.fullName} onChange={handleChange} placeholder="Ramesh Kumar" maxLength={100} />
          </Field>
          <Field label="Mobile Number" required error={errors.mobile}>
            <input name="mobile" type="tel" inputMode="tel" value={form.mobile} onChange={handleChange} placeholder="9876543210" maxLength={16} />
          </Field>
          <Field label="Email" error={errors.email}>
            <input name="email" type="email" inputMode="email" value={form.email} onChange={handleChange} placeholder="name@example.com" />
          </Field>
        </section>

        <section className="card form-section">
          <h2>Room Information</h2>
          <Field label="Building" required error={errors.blockId}>
            <select name="blockId" value={form.blockId} onChange={handleChange}>
              <option value="">Select building</option>
              {blocks.map((block) => (
                <option key={block._id} value={block._id}>
                  {block.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Room" required error={errors.roomId}>
            <select name="roomId" value={form.roomId} onChange={handleChange} disabled={!form.blockId || roomsLoading}>
              <option value="">
                {!form.blockId ? 'Select a building first' : roomsLoading ? 'Loading rooms...' : 'Select room'}
              </option>
              {rooms.map((room) => {
                const full = room.available === 0 && room._id !== originalRoomId;
                return (
                  <option key={room._id} value={room._id} disabled={full}>
                    Room {room.roomNumber} · {room.roomType} · {full ? 'Full' : `${room.available} free`}
                  </option>
                );
              })}
            </select>
          </Field>
          <Field
            label="Sharing Type"
            required
            error={errors.sharingType}
            hint={selectedRoom ? `Room ${selectedRoom.roomNumber} supports ${selectedRoom.capacity} Sharing.` : ''}
          >
            <select name="sharingType" value={form.sharingType} onChange={handleChange}>
              <option value="">Select sharing type</option>
              {SHARING_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>
        </section>

        <section className="card form-section">
          <h2>Stay Information</h2>
          <div className="field-row">
            <Field label="Date of Joining" required error={errors.dateOfJoining}>
              <input name="dateOfJoining" type="date" value={form.dateOfJoining} onChange={handleChange} />
            </Field>
            <Field label="Expected Check Out Date" error={errors.expectedCheckoutDate}>
              <input
                name="expectedCheckoutDate"
                type="date"
                value={form.expectedCheckoutDate}
                min={form.dateOfJoining || undefined}
                onChange={handleChange}
              />
            </Field>
          </div>
        </section>

        <section className="card form-section">
          <h2>Payment Information</h2>
          <div className="field-row">
            <Field label="Monthly Rent" required error={errors.monthlyRent}>
              <input
                name="monthlyRent"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={form.monthlyRent}
                onChange={handleChange}
                placeholder="8000"
              />
            </Field>
            <Field
              label="Security Deposit"
              error={errors.securityDeposit}
              hint="Leave blank if no deposit was collected."
            >
              <input
                name="securityDeposit"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={form.securityDeposit}
                onChange={handleChange}
                placeholder="5000"
              />
            </Field>
          </div>
          {isEdit && (
            <p className="field-hint">
              {rentSummary?.current == null && !rentSummary?.billingStartsOn
                ? 'No rent was recorded for this customer before. Monthly billing will start from this month once you save.'
                : `A rent change applies from ${nextMonthLabel}. Months already billed keep their original amount.`}
            </p>
          )}
        </section>

        <section className="card form-section">
          <h2>ID Proof Details</h2>
          <Field label="ID Proof Type" required error={errors.idProofType}>
            <select name="idProofType" value={form.idProofType} onChange={handleChange}>
              <option value="">Select ID proof</option>
              {ID_PROOF_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ID Number" required error={errors.idNumber}>
            <input name="idNumber" value={form.idNumber} onChange={handleChange} placeholder="1234 5678 9012" maxLength={30} />
          </Field>

          <Field label="Upload ID Proof" required error={errors.idProofFile} hint="JPG, PNG, WEBP or PDF · max 5 MB. Separate from the profile photo.">
            <div className="upload-row">
              <label className="upload-box">
                <Icon name="upload" size={24} />
                <span>{idFile || hasSavedId ? 'Replace file' : 'Choose file'}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleIdFile} hidden />
              </label>
              {idPreviewUrl && <img className="upload-preview" src={idPreviewUrl} alt="ID proof preview" />}
              {idFile && !idPreviewUrl && (
                <div className="upload-file">
                  <Icon name="file" size={22} /> {idFile.name}
                </div>
              )}
              {!idFile && hasSavedId && !existingIdIsPdf && (
                <img className="upload-preview" src={idProofUrl(id)} alt="Current ID proof" />
              )}
              {!idFile && hasSavedId && existingIdIsPdf && (
                <a className="upload-file" href={idProofUrl(id)} target="_blank" rel="noreferrer">
                  <Icon name="file" size={22} /> {existingIdProof.originalName || 'Current PDF'} (open)
                </a>
              )}
            </div>
            {isEdit && existingIdProof && !existingIdProof.available && !idFile && (
              <span className="field-error">The saved ID document could not be found. Please upload it again.</span>
            )}
            {isEdit && hasSavedId && !idFile && (
              <span className="field-hint">The saved document is kept unless you choose a replacement.</span>
            )}
          </Field>
        </section>

        <div className="form-actions">
          <button type="button" className="btn btn-outline" onClick={() => navigate(-1)} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-gold btn-block" disabled={saving}>
            {saving ? 'Saving customer...' : 'Save Customer'}
          </button>
        </div>
      </form>
    </>
  );
}
