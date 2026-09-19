export default function EmptyState({ title, children }) {
  return (
    <div className="state-box">
      <p className="state-title">{title}</p>
      {children}
    </div>
  );
}
