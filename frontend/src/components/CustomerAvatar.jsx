import { useState } from 'react';
import { profilePhotoUrl } from '../services/api.js';
import { initials } from '../utils/format.js';

/**
 * Shows the customer's dedicated profile photo - never the ID proof. Falls back to a
 * default initials avatar when there is no photo or it cannot be loaded.
 */
export default function CustomerAvatar({ customer, size = 'md' }) {
  const [failed, setFailed] = useState(false);
  const sizeClass = size === 'lg' ? 'avatar-lg' : '';

  if (customer.profilePhoto && !failed) {
    return (
      <img
        className={`avatar avatar-img ${sizeClass}`}
        src={profilePhotoUrl(customer._id, customer.updatedAt)}
        alt=""
        onError={() => setFailed(true)}
      />
    );
  }
  return <div className={`avatar ${sizeClass}`}>{initials(customer.fullName)}</div>;
}
