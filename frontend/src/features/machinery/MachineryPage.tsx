import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../app/providers/AuthProvider';
import { useRouter } from '../../app/routes/routes';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  SectionHeading,
  StatusBadge,
} from '../../components/ui';
import { ApiError } from '../../services/apiClient';
import {
  createMachineryBooking,
  createMachineryListing,
  fetchMachineryBookings,
  fetchMachineryListings,
  type MachineryBookingItem,
  type MachineryListingItem,
} from '../../services/pillarService';

export default function MachineryPage() {
  const { session, signInDemo, logout } = useAuth();
  const { navigate } = useRouter();

  const [listings, setListings] = useState<MachineryListingItem[]>([]);
  const [bookings, setBookings] = useState<MachineryBookingItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [equipmentName, setEquipmentName] = useState('');
  const [category, setCategory] = useState('tractor');
  const [hourlyRate, setHourlyRate] = useState('');
  const [district, setDistrict] = useState(session?.farmerProfile?.district || 'Guntur');
  const [stateName, setStateName] = useState(session?.farmerProfile?.state || 'Andhra Pradesh');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const [lRes, bRes] = await Promise.all([
        fetchMachineryListings(session, { category: categoryFilter || undefined }),
        fetchMachineryBookings(session),
      ]);
      setListings(lRes);
      setBookings(bRes);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to load machinery listings.');
    }
  }, [session, categoryFilter, logout]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (!session) {
    return (
      <div className="page-container">
        <EmptyState
          icon="🚜"
          title="Sign in to access Farm Machinery Services"
          description="Browse local tractors, sprayers, and harvesters or list your own equipment for hire."
          action={
            <div className="row-wrap">
              <Button variant="primary" onClick={() => navigate('/login')}>Farmer Login →</Button>
              <Button variant="secondary" onClick={() => signInDemo()}>Try Demo Mode</Button>
            </div>
          }
        />
      </div>
    );
  }

  const handleAddListing = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await createMachineryListing(session, {
        equipmentName: equipmentName.trim(),
        category,
        hourlyRateInr: Number(hourlyRate),
        district: district.trim(),
        state: stateName.trim(),
      });
      setEquipmentName('');
      setHourlyRate('');
      setNotice('Equipment listing added.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list equipment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestBooking = async (listingId: string) => {
    setError(null);
    setNotice(null);
    const start = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const end = new Date(Date.now() + 28 * 3600 * 1000).toISOString();
    try {
      await createMachineryBooking(session, { listingId, startDate: start, endDate: end, notes: 'Requested via AgriVoice web' });
      setNotice('Equipment booking requested.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request booking.');
    }
  };

  return (
    <div className="page-container stack-lg">
      <SectionHeading
        eyebrow="Pillar 4 · Farm Machinery & Equipment"
        title="Machinery Rental & Custom Hiring"
        description="Discover available farm equipment nearby or list your machinery for custom hiring."
        as="h1"
        action={
          <StatusBadge tone={session.mode === 'live' ? 'success' : 'warning'}>
            {session.mode === 'live' ? 'Live Account' : 'Demo Preview'}
          </StatusBadge>
        }
      />

      {notice ? <div className="av-alert av-alert--success" role="status">{notice}</div> : null}
      {error ? <ErrorState title="Machinery Error" message={error} onRetry={() => void loadData()} /> : null}

      <Card>
        <CardHeader
          title="Available Equipment"
          action={
            <select aria-label="Filter equipment category" className="av-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All Categories</option>
              <option value="tractor">Tractor</option>
              <option value="harvester">Harvester</option>
              <option value="sprayer">Sprayer</option>
              <option value="drone">Agri Drone</option>
              <option value="seeder">Seeder</option>
              <option value="pump">Pump</option>
            </select>
          }
        />
        {listings.length > 0 ? (
          <div className="grid-2">
            {listings.map((item) => (
              <Card key={item.id} tone="muted">
                <CardHeader
                  title={item.equipmentName}
                  subtitle={`${item.category} · ${item.district}, ${item.state}`}
                  action={<StatusBadge tone="success">{item.availabilityStatus}</StatusBadge>}
                />
                <p style={{ margin: '0 0 12px' }}>Rate: <strong>₹{item.hourlyRateInr}/hour</strong></p>
                <Button variant="primary" size="sm" onClick={() => void handleRequestBooking(item.id)}>
                  Request Booking
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <p className="av-card-subtitle">No machinery listings found for this filter.</p>
        )}
      </Card>

      <div className="grid-2">
        <Card>
          <CardHeader title="List Your Equipment for Hire" />
          <form className="stack-sm" onSubmit={handleAddListing}>
            <div className="av-field">
              <label htmlFor="mach-name">Equipment Name</label>
              <input id="mach-name" className="av-input" required placeholder="e.g. Mahindra 575 DI Tractor" value={equipmentName} onChange={(e) => setEquipmentName(e.target.value)} />
            </div>
            <div className="grid-2">
              <div className="av-field">
                <label htmlFor="mach-cat">Category</label>
                <select id="mach-cat" className="av-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="tractor">Tractor</option>
                  <option value="harvester">Harvester</option>
                  <option value="sprayer">Sprayer</option>
                  <option value="drone">Agri Drone</option>
                  <option value="seeder">Seeder</option>
                  <option value="pump">Pump</option>
                </select>
              </div>
              <div className="av-field">
                <label htmlFor="mach-rate">Hourly Rate (₹)</label>
                <input id="mach-rate" className="av-input" type="number" min="1" required value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
              </div>
              <div className="av-field">
                <label htmlFor="mach-dist">District</label>
                <input id="mach-dist" className="av-input" required value={district} onChange={(e) => setDistrict(e.target.value)} />
              </div>
              <div className="av-field">
                <label htmlFor="mach-state">State</label>
                <input id="mach-state" className="av-input" required value={stateName} onChange={(e) => setStateName(e.target.value)} />
              </div>
            </div>
            <Button type="submit" variant="secondary" loading={submitting}>Add Equipment Listing</Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="My Booking Requests" />
          {bookings.length > 0 ? (
            <div className="table-scroll">
              <table className="av-table">
                <thead>
                  <tr>
                    <th>Start</th>
                    <th>Status</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id}>
                      <td>{new Date(b.startDate).toLocaleDateString()}</td>
                      <td><StatusBadge tone="info">{b.status}</StatusBadge></td>
                      <td>{b.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="av-card-subtitle">No machinery bookings requested yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
