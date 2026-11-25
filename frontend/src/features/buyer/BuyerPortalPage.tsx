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
  browseOpenProduce,
  cancelBuyerRequest,
  fetchBuyerDashboard,
  fetchBuyerOrders,
  fetchBuyerRequests,
  submitBuyerRequest,
  toggleSaveProduceListing,
  updateBuyerProfile,
  type BuyerDashboardData,
  type PublicProduceListing,
  type PurchaseRequestItem,
} from '../../services/buyerService';

type BuyerTab = 'dashboard' | 'browse' | 'requests' | 'orders' | 'profile';

export default function BuyerPortalPage() {
  const { session, logout } = useAuth();
  const { navigate } = useRouter();

  const [activeTab, setActiveTab] = useState<BuyerTab>('dashboard');
  const [dashboard, setDashboard] = useState<BuyerDashboardData | null>(null);
  const [listings, setListings] = useState<PublicProduceListing[]>([]);
  const [requests, setRequests] = useState<PurchaseRequestItem[]>([]);
  const [orders, setOrders] = useState<PurchaseRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Browse filters
  const [cropFilter, setCropFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [maxPriceFilter, setMaxPriceFilter] = useState('');
  const [selectedListing, setSelectedListing] = useState<PublicProduceListing | null>(null);

  // Request modal/form state
  const [reqType, setReqType] = useState<'enquiry' | 'purchase_request'>('purchase_request');
  const [reqQty, setReqQty] = useState('');
  const [reqPrice, setReqPrice] = useState('');
  const [reqMessage, setReqMessage] = useState('');
  const [submittingReq, setSubmittingReq] = useState(false);

  // Profile form state
  const [bizName, setBizName] = useState('');
  const [contactName, setContactName] = useState('');
  const [bizType, setBizType] = useState('wholesaler');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [stateName, setStateName] = useState('');
  const [gstNumber, setGstNumber] = useState('');

  const loadBuyerData = useCallback(async () => {
    if (!session || session.role !== 'buyer') return;
    setLoading(true);
    setError(null);
    try {
      const [dashRes, listRes, reqRes, ordRes] = await Promise.all([
        fetchBuyerDashboard(session),
        browseOpenProduce(session, {
          crop: cropFilter.trim() || undefined,
          district: districtFilter.trim() || undefined,
          maxPrice: maxPriceFilter ? Number(maxPriceFilter) : undefined,
        }),
        fetchBuyerRequests(session),
        fetchBuyerOrders(session),
      ]);
      setDashboard(dashRes);
      setListings(listRes);
      setRequests(reqRes);
      setOrders(ordRes);
      setBizName(dashRes.buyerProfile.businessName);
      setContactName(dashRes.buyerProfile.contactName);
      setBizType(dashRes.buyerProfile.businessType);
      setCity(dashRes.buyerProfile.city);
      setDistrict(dashRes.buyerProfile.district);
      setStateName(dashRes.buyerProfile.state);
      setGstNumber(dashRes.buyerProfile.gstOrLicenseNumber || '');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to load Buyer Portal.');
    } finally {
      setLoading(false);
    }
  }, [session, cropFilter, districtFilter, maxPriceFilter, logout]);

  useEffect(() => {
    void loadBuyerData();
  }, [loadBuyerData]);

  if (!session) {
    return (
      <div className="page-container">
        <EmptyState
          icon="🛒"
          title="Buyer Sign-In Required"
          description="Sign in with your Buyer account to browse verified farmer produce and manage purchase requests."
          action={<Button variant="primary" onClick={() => navigate('/login')}>Go to Buyer Login →</Button>}
        />
      </div>
    );
  }

  if (session.role !== 'buyer') {
    return (
      <div className="page-container">
        <EmptyState
          icon="🔒"
          title="Buyer Account Required"
          description="You are signed in as a Farmer. Farmer accounts cannot access Buyer Portal management."
          action={<Button variant="primary" onClick={() => navigate('/dashboard')}>Return to Farmer Dashboard →</Button>}
        />
      </div>
    );
  }

  const handleSendRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedListing) return;
    setSubmittingReq(true);
    setError(null);
    setNotice(null);
    try {
      await submitBuyerRequest(session, {
        listingId: selectedListing.id,
        requestType: reqType,
        requestedQuantityQuintals: Number(reqQty),
        offeredPriceInr: Number(reqPrice),
        message: reqMessage.trim() || undefined,
      });
      setNotice(`Sent ${reqType === 'enquiry' ? 'purchase enquiry' : 'purchase request'} for ${selectedListing.cropName}.`);
      setSelectedListing(null);
      setReqQty('');
      setReqPrice('');
      setReqMessage('');
      await loadBuyerData();
      setActiveTab('requests');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request.');
    } finally {
      setSubmittingReq(false);
    }
  };

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await updateBuyerProfile(session, {
        businessName: bizName.trim(),
        contactName: contactName.trim(),
        businessType: bizType,
        city: city.trim(),
        district: district.trim(),
        state: stateName.trim(),
        gstOrLicenseNumber: gstNumber.trim() || null,
      });
      setNotice('Buyer business profile updated.');
      await loadBuyerData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile.');
    }
  };

  return (
    <div className="page-container stack-lg">
      <SectionHeading
        eyebrow="AgriVoice Buyer Portal"
        title={dashboard?.buyerProfile.businessName || 'Buyer Dashboard'}
        description={`${dashboard?.buyerProfile.contactName || ''} · ${dashboard?.buyerProfile.city || ''}, ${dashboard?.buyerProfile.district || ''}`}
        as="h1"
        action={<StatusBadge tone="success">Verified Buyer Session</StatusBadge>}
      />

      <div className="tab-bar" role="tablist" aria-label="Buyer Portal Navigation">
        {([
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'browse', label: 'Browse Produce' },
          { id: 'requests', label: `Purchase Requests (${requests.length})` },
          { id: 'orders', label: `Orders (${orders.length})` },
          { id: 'profile', label: 'Business Profile' },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {notice ? <div className="av-alert av-alert--success" role="status">{notice}</div> : null}
      {error ? <ErrorState title="Buyer Portal Error" message={error} onRetry={() => void loadBuyerData()} /> : null}
      {loading && !dashboard ? <LoadingState label="Loading Buyer Portal..." /> : null}

      {activeTab === 'dashboard' && dashboard ? (
        <div className="stack-md">
          <div className="grid-3">
            <Card>
              <small className="av-card-subtitle">Available Produce Lots</small>
              <h2 style={{ margin: '8px 0 4px' }}>{dashboard.summary.availableProduceCount}</h2>
              <Button variant="outline" size="sm" onClick={() => setActiveTab('browse')}>Browse Produce →</Button>
            </Card>
            <Card>
              <small className="av-card-subtitle">Pending / Negotiating Requests</small>
              <h2 style={{ margin: '8px 0 4px' }}>{dashboard.summary.pendingRequestsCount}</h2>
              <Button variant="outline" size="sm" onClick={() => setActiveTab('requests')}>View Requests →</Button>
            </Card>
            <Card>
              <small className="av-card-subtitle">Accepted / Fulfilled Orders</small>
              <h2 style={{ margin: '8px 0 4px' }}>{dashboard.summary.acceptedOrdersCount}</h2>
              <Button variant="outline" size="sm" onClick={() => setActiveTab('orders')}>View Orders →</Button>
            </Card>
          </div>

          <Card>
            <CardHeader title="Recent Buyer Activity" />
            {dashboard.recentRequests.length > 0 ? (
              <div className="table-scroll">
                <table className="av-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Qty (Qtl)</th>
                      <th>Offered Price</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.recentRequests.map((r) => (
                      <tr key={r.id}>
                        <td>{r.requestType}</td>
                        <td>{r.requestedQuantityQuintals}</td>
                        <td>₹{r.offeredPriceInr}/qtl</td>
                        <td><StatusBadge tone={r.status === 'accepted' ? 'success' : 'info'}>{r.status}</StatusBadge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="av-card-subtitle">No purchase requests yet. Browse open farmer produce to send an enquiry.</p>
            )}
          </Card>
        </div>
      ) : null}

      {activeTab === 'browse' ? (
        <div className="stack-md">
          <Card>
            <CardHeader title="Search & Filter Farmer Produce" />
            <div className="grid-3">
              <input className="av-input" placeholder="Search crop (e.g. Paddy)" value={cropFilter} onChange={(e) => setCropFilter(e.target.value)} />
              <input className="av-input" placeholder="Filter district (e.g. Guntur)" value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)} />
              <input className="av-input" type="number" placeholder="Max price (₹/qtl)" value={maxPriceFilter} onChange={(e) => setMaxPriceFilter(e.target.value)} />
            </div>
          </Card>

          {selectedListing ? (
            <Card tone="accent">
              <CardHeader
                title={`Send Request: ${selectedListing.cropName}`}
                subtitle={`Seller: ${selectedListing.sellerName} · ${selectedListing.district}, ${selectedListing.state} · Asking ₹${selectedListing.expectedPriceInr}/qtl (${selectedListing.quantityQuintals} qtl available)`}
                action={<Button variant="ghost" size="sm" onClick={() => setSelectedListing(null)}>Close</Button>}
              />
              <form className="stack-sm" onSubmit={handleSendRequest}>
                <div className="grid-3">
                  <div className="av-field">
                    <label htmlFor="req-type">Request Type</label>
                    <select id="req-type" className="av-select" value={reqType} onChange={(e) => setReqType(e.target.value as 'enquiry' | 'purchase_request')}>
                      <option value="purchase_request">Purchase Request</option>
                      <option value="enquiry">Purchase Enquiry</option>
                    </select>
                  </div>
                  <div className="av-field">
                    <label htmlFor="req-qty">Quantity (Quintals)</label>
                    <input id="req-qty" className="av-input" type="number" step="0.1" min="0.1" required value={reqQty} onChange={(e) => setReqQty(e.target.value)} />
                  </div>
                  <div className="av-field">
                    <label htmlFor="req-price">Offered Price (₹/Quintal)</label>
                    <input id="req-price" className="av-input" type="number" min="1" required value={reqPrice} onChange={(e) => setReqPrice(e.target.value)} />
                  </div>
                </div>
                <div className="av-field">
                  <label htmlFor="req-msg">Message to Farmer</label>
                  <textarea id="req-msg" className="av-input" rows={2} placeholder="Pickup timeline, moisture/quality questions..." value={reqMessage} onChange={(e) => setReqMessage(e.target.value)} />
                </div>
                <Button type="submit" variant="primary" loading={submittingReq}>Submit to Farmer</Button>
              </form>
            </Card>
          ) : null}

          <div className="grid-2">
            {listings.map((item) => (
              <Card key={item.id}>
                <CardHeader
                  title={item.cropName}
                  subtitle={`${item.sellerName} · ${item.district}, ${item.state}`}
                  action={<StatusBadge tone="success">{item.qualityGrade || 'FAQ'}</StatusBadge>}
                />
                <p style={{ margin: '0 0 8px' }}>
                  <strong>{item.quantityQuintals} qtl</strong> available at <strong>₹{item.expectedPriceInr}/qtl</strong>
                </p>
                {item.notes ? <p className="av-card-subtitle" style={{ marginBottom: 12 }}>{item.notes}</p> : null}
                <div className="row-wrap">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setSelectedListing(item);
                      setReqQty(String(item.quantityQuintals));
                      setReqPrice(String(item.expectedPriceInr));
                    }}
                  >
                    Enquire / Request Purchase
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await toggleSaveProduceListing(session, item.id, item.isSaved);
                      await loadBuyerData();
                    }}
                  >
                    {item.isSaved ? 'Saved ✓' : 'Save Listing'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === 'requests' ? (
        <Card>
          <CardHeader title="Purchase Enquiries & Requests" />
          {requests.length > 0 ? (
            <div className="table-scroll">
              <table className="av-table">
                <thead>
                  <tr>
                    <th>Crop & Seller</th>
                    <th>Qty / Offer</th>
                    <th>Status</th>
                    <th>Farmer Response</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td>{r.cropName} ({r.sellerName})</td>
                      <td>{r.requestedQuantityQuintals} qtl @ ₹{r.offeredPriceInr}/qtl</td>
                      <td><StatusBadge tone={r.status === 'accepted' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}>{r.status}</StatusBadge></td>
                      <td>{r.farmerResponse || 'Awaiting response'}</td>
                      <td>
                        {r.status === 'pending' || r.status === 'negotiating' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              await cancelBuyerRequest(session, r.id);
                              await loadBuyerData();
                            }}
                          >
                            Cancel
                          </Button>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="av-card-subtitle">No purchase requests sent yet.</p>
          )}
        </Card>
      ) : null}

      {activeTab === 'orders' ? (
        <Card>
          <CardHeader title="Accepted Orders & History" />
          {orders.length > 0 ? (
            <div className="table-scroll">
              <table className="av-table">
                <thead>
                  <tr>
                    <th>Crop</th>
                    <th>Farmer</th>
                    <th>Quantity</th>
                    <th>Agreed Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.cropName}</td>
                      <td>{o.sellerName} ({o.district})</td>
                      <td>{o.requestedQuantityQuintals} qtl</td>
                      <td>₹{o.offeredPriceInr}/qtl</td>
                      <td><StatusBadge tone="success">{o.status}</StatusBadge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="av-card-subtitle">No accepted orders yet.</p>
          )}
        </Card>
      ) : null}

      {activeTab === 'profile' ? (
        <Card>
          <CardHeader
            title="Buyer Business Profile"
            action={<StatusBadge tone="info">{dashboard?.buyerProfile.verificationStatus || 'self_declared'}</StatusBadge>}
          />
          <form className="stack-sm" onSubmit={handleProfileSave}>
            <div className="grid-2">
              <div className="av-field">
                <label htmlFor="bp-biz">Business Name</label>
                <input id="bp-biz" className="av-input" required value={bizName} onChange={(e) => setBizName(e.target.value)} />
              </div>
              <div className="av-field">
                <label htmlFor="bp-contact">Contact Name</label>
                <input id="bp-contact" className="av-input" required value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </div>
              <div className="av-field">
                <label htmlFor="bp-type">Business Type</label>
                <select id="bp-type" className="av-select" value={bizType} onChange={(e) => setBizType(e.target.value)}>
                  <option value="wholesaler">Wholesaler / Mandi Trader</option>
                  <option value="processor">Agro Processor / Mill</option>
                  <option value="exporter">Exporter</option>
                  <option value="fpo_buyer">FPO / Institutional Buyer</option>
                  <option value="retailer">Retailer</option>
                </select>
              </div>
              <div className="av-field">
                <label htmlFor="bp-gst">GST / Mandi License (Optional)</label>
                <input id="bp-gst" className="av-input" value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} />
              </div>
              <div className="av-field">
                <label htmlFor="bp-city">City</label>
                <input id="bp-city" className="av-input" required value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="av-field">
                <label htmlFor="bp-district">District</label>
                <input id="bp-district" className="av-input" required value={district} onChange={(e) => setDistrict(e.target.value)} />
              </div>
              <div className="av-field">
                <label htmlFor="bp-state">State</label>
                <input id="bp-state" className="av-input" required value={stateName} onChange={(e) => setStateName(e.target.value)} />
              </div>
            </div>
            <Button type="submit" variant="primary">Save Business Profile</Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
