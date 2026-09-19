export default function Loader({ text = 'Loading...' }) {
  return (
    <div className="loader" role="status">
      <span className="spinner" />
      <span>{text}</span>
    </div>
  );
}
