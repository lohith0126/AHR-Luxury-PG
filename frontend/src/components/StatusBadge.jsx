const STYLES = {
  Available: 'badge-green',
  'Partially Occupied': 'badge-orange',
  'Fully Occupied': 'badge-red',
  Active: 'badge-green',
  'Checked Out': 'badge-gray',
};

export default function StatusBadge({ status }) {
  return <span className={`badge ${STYLES[status] || 'badge-gray'}`}>{status}</span>;
}
