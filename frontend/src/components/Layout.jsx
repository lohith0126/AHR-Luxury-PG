import { Link, NavLink, Outlet } from 'react-router-dom';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/blocks', label: 'Blocks', icon: 'building' },
  { to: '/customers', label: 'Customers', icon: 'users' },
];

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <Logo size={34} />
          <span className="brand-name">AHR Luxury Gents PG</span>
        </Link>
        <nav className="topnav" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="container">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Main">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
