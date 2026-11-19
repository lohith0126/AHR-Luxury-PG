import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { compressImage } from '../utils/imageCompress.js';
import { initials } from '../utils/format.js';

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Profile photo picker, completely separate from the ID proof field.
 *  - "Open Camera": live webcam/phone-camera capture where the browser allows it; otherwise
 *    it falls back to the phone's native camera through a capture-enabled file input.
 *  - "Choose From Files": any existing image on the device.
 * Either way a single File is handed back through onChange(file | null, errorMessage?).
 */
export default function ProfilePhotoField({ previewUrl, fallbackName, error, onChange }) {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const acceptFile = async (picked) => {
    if (!picked) return;
    if (!ALLOWED_TYPES.includes(picked.type)) {
      onChange(null, 'Profile photo must be a JPG, PNG or WEBP image.');
      return;
    }
    const smaller = await compressImage(picked, { maxSide: 1024, quality: 0.85 });
    if (smaller.size > MAX_PHOTO_BYTES) {
      onChange(null, 'Photo is too large. Maximum size is 3 MB.');
      return;
    }
    onChange(smaller);
  };

  const handleInput = (event) => {
    const picked = event.target.files?.[0];
    event.target.value = '';
    acceptFile(picked);
  };

  const openCamera = async () => {
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click(); // native camera app on phones
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      setCameraError('Could not open the camera. Allow camera access, or use "Choose From Files".');
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        stopCamera();
        if (blob) acceptFile(new File([blob], `profile-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.9
    );
  };

  return (
    <div className={`field photo-field ${error ? 'has-error' : ''}`}>
      <label>Profile Photo</label>
      <div className="photo-row">
        {previewUrl ? (
          <img className="photo-preview" src={previewUrl} alt="Profile preview" />
        ) : (
          <div className="photo-placeholder">
            {fallbackName ? initials(fallbackName) : <Icon name="user" size={30} />}
          </div>
        )}
        <div className="photo-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={openCamera}>
            <Icon name="camera" size={16} /> Open Camera
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()}>
            <Icon name="upload" size={16} /> Choose From Files
          </button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleInput} hidden />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="user" onChange={handleInput} hidden />
        </div>
      </div>
      <span className="field-hint">{previewUrl ? 'Use either button again to replace the photo.' : 'Optional. JPG, PNG or WEBP.'}</span>
      {cameraError && <span className="field-error">{cameraError}</span>}
      {error && <span className="field-error">{error}</span>}

      {cameraOpen && (
        <div className="camera-overlay" role="dialog" aria-modal="true" aria-label="Capture profile photo">
          <video ref={videoRef} autoPlay playsInline muted />
          <div className="camera-controls">
            <button type="button" className="btn btn-outline" onClick={stopCamera}>
              Cancel
            </button>
            <button type="button" className="btn btn-gold" onClick={capturePhoto}>
              <Icon name="camera" size={18} /> Capture
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
