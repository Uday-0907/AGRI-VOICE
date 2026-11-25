import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../app/providers/AuthProvider';
import { useRouter } from '../../app/routes/routes';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeading,
  StatusBadge,
} from '../../components/ui';
import { ApiError } from '../../services/apiClient';
import {
  createBuyerListing,
  createMarketPrice,
  fetchBuyerListings,
  fetchMarketPrices,
  type BuyerListingItem,
  type MarketPriceItem,
} from '../../services/pillarService';
import {
  fetchIncomingFarmerRequests,
  respondToBuyerRequest,
  type PurchaseRequestItem,
} from '../../services/buyerService';

export default function MarketsPage() {
  const { session, signInDemo, logout } = useAuth();
  const { navigate } = useRouter();

  const [prices, setPrices] = useState<MarketPriceItem[]>([]);
  const [listings, setListings] = useState<BuyerListingItem[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<PurchaseRequestItem[]>([]);
  const [commodityFilter, setCommodityFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Listing form
  const [cropName, setCropName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expectedPrice, setExpectedPrice] = useState('');
  const [district, setDistrict] = useState(session?.farmerProfile?.district || 'Guntur');
  const [stateName, setStateName] = useState(session?.farmerProfile?.state || 'Andhra Pradesh');
  const [submitting, setSubmitting] = useState(false);

  // Mandi price report form
  const [reportCommodity, setReportCommodity] = useState('');
  const [reportMarket, setReportMarket] = useState('');
  const [reportModalPrice, setReportModalPrice] = useState('');

  const loadData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const [pRes, lRes, reqRes] = await Promise.all([
        fetchMarketPrices(session, { commodity: commodityFilter.trim() || undefined }),
        fetchBuyerListings(session),
        fetchIncomingFarmerRequests(session),
      ]);
      setPrices(pRes);
      setListings(lRes);
      setIncomingRequests(reqRes);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to load market data.');
    } finally {
      setLoading(false);
    }
  }, [session, commodityFilter, logout]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (!session) {
    return (
      <div className="page-container">
        <EmptyState
          icon="🏪"
          title="Sign in to access Markets & Buyer Connections"
          description="Connect your farmer account or preview Demo Mode to view mandi prices and publish crop sell listings."
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

  const handleListingSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await createBuyerListing(session, {
        cropName: cropName.trim(),
        quantityQuintals: Number(quantity),
        expectedPriceInr: Number(expectedPrice),
        district: district.trim(),
        state: stateName.trim(),
      });
      setCropName('');
      setQuantity('');
      setExpectedPrice('');
      setNotice('Crop sell listing published.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish listing.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePriceReport = async (e: FormEvent) => {
    e.preventDefault();
    if (!reportCommodity.trim() || !reportMarket.trim() || !reportModalPrice) return;
    const modal = Number(reportModalPrice);
    try {
      await createMarketPrice(session, {
        commodity: reportCommodity.trim(),
        marketName: reportMarket.trim(),
        district: district.trim(),
        state: stateName.trim(),
        minPriceInr: Math.max(1, modal - 100),
        maxPriceInr: modal + 100,
        modalPriceInr: modal,
      });
      setReportCommodity('');
      setReportMarket('');
      setReportModalPrice('');
      setNotice('Mandi price observation recorded.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record price.');
    }
  };

  return (
    <div className="page-container stack-lg">
      <SectionHeading
        eyebrow="Pillar 3 · Markets & Buyer Connections"
        title="Mandi Prices & Crop Listings"
        description="Track local mandi price observations and publish your harvest lots for buyers."
        as="h1"
        action={
          <StatusBadge tone={session.mode === 'live' ? 'success' : 'warning'}>
            {session.mode === 'live' ? 'Live Account' : 'Demo Preview'}
          </StatusBadge>
        }
      />

      {notice ? <div className="av-alert av-alert--success" role="status">{notice}</div> : null}
      {error ? <ErrorState title="Market Error" message={error} onRetry={() => void loadData()} /> : null}
      {loading && prices.length === 0 ? <LoadingState label="Loading market data..." /> : null}

      <Card>
        <CardHeader
          title="Mandi Price Board"
          subtitle="Filter recorded APMC / farmer-reported mandi prices"
          action={
            <input
              aria-label="Filter by commodity"
              className="av-input"
              placeholder="Search commodity (e.g. Paddy)"
              value={commodityFilter}
              onChange={(e) => setCommodityFilter(e.target.value)}
            />
          }
        />
        {prices.length > 0 ? (
          <div className="table-scroll">
            <table className="av-table">
              <thead>
                <tr>
                  <th>Commodity</th>
                  <th>Market</th>
                  <th>District</th>
                  <th>Modal Price</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((p) => (
                  <tr key={p.id}>
                    <td>{p.commodity}</td>
                    <td>{p.marketName}</td>
                    <td>{p.district}</td>
                    <td>₹{p.modalPriceInr} / {p.unit}</td>
                    <td><StatusBadge tone={p.source === 'demo' ? 'warning' : 'info'}>{p.source}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="av-card-subtitle">No mandi price observations recorded yet. Submit one below.</p>
        )}
      </Card>

      <div className="grid-2">
        <Card>
          <CardHeader title="Publish Crop Sell Listing" subtitle="Connect directly with buyers for your harvest lot" />
          <form className="stack-sm" onSubmit={handleListingSubmit}>
            <div className="av-field">
              <label htmlFor="mkt-crop">Crop Name</label>
              <input id="mkt-crop" className="av-input" required placeholder="e.g. Paddy MTU-1010" value={cropName} onChange={(e) => setCropName(e.target.value)} />
            </div>
            <div className="grid-2">
              <div className="av-field">
                <label htmlFor="mkt-qty">Quantity (Quintals)</label>
                <input id="mkt-qty" className="av-input" type="number" step="0.1" min="0.1" required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div className="av-field">
                <label htmlFor="mkt-price">Expected Price (₹/Quintal)</label>
                <input id="mkt-price" className="av-input" type="number" min="1" required value={expectedPrice} onChange={(e) => setExpectedPrice(e.target.value)} />
              </div>
              <div className="av-field">
                <label htmlFor="mkt-district">District</label>
                <input id="mkt-district" className="av-input" required value={district} onChange={(e) => setDistrict(e.target.value)} />
              </div>
              <div className="av-field">
                <label htmlFor="mkt-state">State</label>
                <input id="mkt-state" className="av-input" required value={stateName} onChange={(e) => setStateName(e.target.value)} />
              </div>
            </div>
            <Button type="submit" variant="primary" loading={submitting}>Publish Sell Listing</Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Report Local Mandi Price" subtitle="Share today's observed APMC rate" />
          <form className="stack-sm" onSubmit={handlePriceReport}>
            <div className="av-field">
              <label htmlFor="rpt-commodity">Commodity</label>
              <input id="rpt-commodity" className="av-input" required placeholder="e.g. Cotton" value={reportCommodity} onChange={(e) => setReportCommodity(e.target.value)} />
            </div>
            <div className="av-field">
              <label htmlFor="rpt-market">Mandi / Market Name</label>
              <input id="rpt-market" className="av-input" required placeholder="e.g. Guntur Mirchi Yard" value={reportMarket} onChange={(e) => setReportMarket(e.target.value)} />
            </div>
            <div className="av-field">
              <label htmlFor="rpt-modal">Modal Price (₹/Quintal)</label>
              <input id="rpt-modal" className="av-input" type="number" min="1" required value={reportModalPrice} onChange={(e) => setReportModalPrice(e.target.value)} />
            </div>
            <Button type="submit" variant="secondary">Record Mandi Price</Button>
          </form>
        </Card>
      </div>

      <Card>
        <CardHeader title="My Active Sell Listings" />
        {listings.length > 0 ? (
          <div className="table-scroll">
            <table className="av-table">
              <thead>
                <tr>
                  <th>Crop</th>
                  <th>Quantity</th>
                  <th>Expected Price</th>
                  <th>District</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((item) => (
                  <tr key={item.id}>
                    <td>{item.cropName}</td>
                    <td>{item.quantityQuintals} qtl</td>
                    <td>₹{item.expectedPriceInr}/qtl</td>
                    <td>{item.district}</td>
                    <td><StatusBadge tone="success">{item.status}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="av-card-subtitle">You have not published any sell listings yet.</p>
        )}
      </Card>

      <Card>
        <CardHeader title="Incoming Buyer Enquiries & Purchase Requests" subtitle="Respond to verified buyers interested in your harvest lots" />
        {incomingRequests.length > 0 ? (
          <div className="table-scroll">
            <table className="av-table">
              <thead>
                <tr>
                  <th>Buyer</th>
                  <th>Crop & Offer</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {incomingRequests.map((req) => (
                  <tr key={req.id}>
                    <td>
                      <strong>{req.buyerBusinessName}</strong>
                      <div className="av-card-subtitle">{req.buyerContactName} · {req.buyerLocation}</div>
                    </td>
                    <td>
                      {req.cropName}: {req.requestedQuantityQuintals} qtl @ ₹{req.offeredPriceInr}/qtl
                      {req.message ? <div className="av-card-subtitle">"{req.message}"</div> : null}
                    </td>
                    <td><StatusBadge tone={req.status === 'accepted' ? 'success' : req.status === 'rejected' ? 'danger' : 'warning'}>{req.status}</StatusBadge></td>
                    <td>
                      {req.status === 'pending' || req.status === 'negotiating' ? (
                        <div className="row-wrap">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={async () => {
                              await respondToBuyerRequest(session, req.id, {
                                status: 'accepted',
                                farmerResponse: 'Accepted by farmer. Ready for pickup coordination.',
                              });
                              setNotice(`Accepted purchase request from ${req.buyerBusinessName}.`);
                              await loadData();
                            }}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              await respondToBuyerRequest(session, req.id, {
                                status: 'rejected',
                                farmerResponse: 'Offer declined by farmer.',
                              });
                              setNotice(`Declined request from ${req.buyerBusinessName}.`);
                              await loadData();
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        req.farmerResponse || 'Responded'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="av-card-subtitle">No incoming buyer requests yet.</p>
        )}
      </Card>
    </div>
  );
}
