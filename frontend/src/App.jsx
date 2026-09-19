import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import BlocksPage from './pages/BlocksPage.jsx';
import BlockPage from './pages/BlockPage.jsx';
import RoomPage from './pages/RoomPage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import CustomerForm from './pages/CustomerForm.jsx';
import CustomerDetails from './pages/CustomerDetails.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="blocks" element={<BlocksPage />} />
        <Route path="blocks/:blockId" element={<BlockPage />} />
        <Route path="rooms/:roomId" element={<RoomPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/new" element={<CustomerForm />} />
        <Route path="customers/:id" element={<CustomerDetails />} />
        <Route path="customers/:id/edit" element={<CustomerForm />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
