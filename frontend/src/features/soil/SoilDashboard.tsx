import {
  Activity,
  ArrowUpRight,
  FlaskConical,
  Leaf,
  Menu,
  Search,
  Sprout,
  TestTube,
  X,
  AlertCircle,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { useState } from 'react';
import SoilCardLookup from './components/SoilCardLookup';
import SoilReportDetails, { type SoilReport } from './components/SoilReportDetails';

type NavItem = 'Overview' | 'Soil Reports' | 'Check Soil Health' | 'Input Verification';
type Notice = { type: 'info' | 'error'; message: string };

export default function SoilDashboard() {
  const [activeNav, setActiveNav] = useState<NavItem>('Overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lookupNotice, setLookupNotice] = useState<Notice | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const [selectedReport, setSelectedReport] = useState<SoilReport | null>(null);

  const navigation: { label: NavItem; icon: typeof Leaf }[] = [
    { label: 'Overview', icon: Activity },
    { label: 'Soil Reports', icon: FlaskConical },
    { label: 'Check Soil Health', icon: TestTube },
    { label: 'Input Verification', icon: Sprout },
  ];

  const openPage = (page: NavItem) => {
    setActiveNav(page);
    setMobileMenuOpen(false);
  };

  const handleSoilLookup = (submittedCardId: string) => {
    const value = submittedCardId.trim();

    if (!value) {
      setLookupNotice({
        type: 'error',
        message: 'Please enter your Soil Health Card ID.',
      });
      return;
    }

    if (value.length < 4) {
      setLookupNotice({
        type: 'error',
        message: 'Please enter a valid card ID with at least 4 characters.',
      });
      return;
    }

    setIsChecking(true);
    setLookupNotice(null);

    window.setTimeout(() => {
      setIsChecking(false);
      setLookupNotice({
        type: 'info',
        message: 'Your Card ID has been entered. Sign in and connect to the soil service to retrieve the official report. No report has been fetched yet.',
      });
    }, 450);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-5 lg:flex">
          <div className="mb-10 flex items-center gap-3">
            <div className="rounded-xl bg-green-600 p-2 text-white"><Sprout size={25} /></div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">AgriVoice</h1>
              <p className="text-xs text-slate-500">Smart Agriculture</p>
            </div>
          </div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Workspace</p>
          <nav className="space-y-2" aria-label="Main navigation">
            {navigation.map(({ label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => openPage(label)}
                aria-current={activeNav === label ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition ${activeNav === label ? 'bg-green-50 text-green-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Icon size={19} />{label}
              </button>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl bg-green-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-green-800"><Leaf size={19} /><span className="font-semibold">Grow smarter</span></div>
            <p className="text-xs leading-5 text-green-800">Understand your soil before choosing agricultural inputs.</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle navigation" aria-expanded={mobileMenuOpen}>
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
              <div>
                <p className="text-sm text-slate-500">Soil Health &amp; Input Management</p>
                <h2 className="text-lg font-bold text-slate-900">Farmer Workspace</h2>
              </div>
            </div>
            <div className="hidden items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-sm font-medium text-green-700 sm:flex">
              <span className="h-2 w-2 rounded-full bg-green-500" />Frontend preview
            </div>
          </header>

          {mobileMenuOpen && (
            <div className="border-b border-slate-200 bg-white p-4 lg:hidden">
              {navigation.map(({ label, icon: Icon }) => (
                <button key={label} onClick={() => openPage(label)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left ${activeNav === label ? 'bg-green-50 text-green-700' : 'text-slate-700 hover:bg-slate-50'}`}>
                  <Icon size={19} />{label}
                </button>
              ))}
            </div>
          )}

          <div className="mx-auto max-w-7xl space-y-7 p-5 sm:p-8">
            <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="mb-1 text-sm font-medium text-green-700">SOIL HEALTH CENTER</p>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{activeNav}</h1>
                <p className="mt-2 text-sm text-slate-500">Monitor soil reports and agricultural input information.</p>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">Sample interface · No live farmer data</div>
            </section>

            {activeNav === 'Overview' && (
              <>
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {[
                    { title: 'Soil Reports', value: '—', description: 'Reports available after sign-in', icon: FlaskConical },
                    { title: 'Input Verifications', value: '—', description: 'Verification records', icon: TestTube },
                    { title: 'Soil Health', value: 'Not available', description: 'No soil report connected', icon: Leaf },
                  ].map(({ title, value, description, icon: Icon }) => (
                    <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-5 flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-500">{title}</p>
                        <div className="rounded-xl bg-green-50 p-3 text-green-700"><Icon size={21} /></div>
                      </div>
                      <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
                      <p className="mt-2 text-xs text-slate-500">{description}</p>
                    </article>
                  ))}
                </section>

                <section className="grid gap-6 xl:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 xl:col-span-2">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900">Soil Health Reports</h3>
                        <p className="mt-1 text-sm text-slate-500">Your soil report history will appear here.</p>
                      </div>
                      <Activity className="text-green-600" />
                    </div>
                    <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                      <FlaskConical className="mb-3 text-slate-400" size={34} />
                      <h4 className="font-semibold text-slate-700">No reports available</h4>
                      <p className="mt-2 max-w-sm text-sm text-slate-500">Sign in and connect a farm to view your official soil health reports.</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-6">
                    <h3 className="font-bold text-slate-900">Quick Actions</h3>
                    <p className="mb-5 mt-1 text-sm text-slate-500">Access soil management tools.</p>
                    <div className="space-y-3">
                      <button onClick={() => openPage('Check Soil Health')} className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-4 text-left hover:border-green-300 hover:bg-green-50">
                        <span className="flex items-center gap-3"><Search className="text-green-700" /><span className="text-sm font-medium">Find Soil Report</span></span><ArrowUpRight size={17} />
                      </button>
                      <button onClick={() => openPage('Input Verification')} className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-4 text-left hover:border-green-300 hover:bg-green-50">
                        <span className="flex items-center gap-3"><TestTube className="text-green-700" /><span className="text-sm font-medium">Verify Input</span></span><ArrowUpRight size={17} />
                      </button>
                    </div>
                  </div>
                </section>
              </>
            )}

            {activeNav === 'Check Soil Health' && (
              <section className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-xl bg-green-50 p-3 text-green-700"><FlaskConical size={24} /></div>
                  <div>
                    <h3 className="font-bold text-slate-900">Soil Health Card Lookup</h3>
                    <p className="text-sm text-slate-500">Find an official soil report</p>
                  </div>
                </div>
                <SoilCardLookup
                  onLookup={(submittedCardId) => {
                    setLookupNotice(null);
                    return handleSoilLookup(submittedCardId);
                  }}
                  loading={isChecking}
                />
                {lookupNotice && (
                  <div role="status" aria-live="polite" className={`mt-4 flex items-start gap-2 rounded-xl border p-4 text-sm ${lookupNotice.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>
                    {lookupNotice.type === 'error' ? <AlertCircle size={19} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={19} className="mt-0.5 shrink-0" />}
                    <p>{lookupNotice.message}</p>
                  </div>
                )}
                <div className="mt-5 rounded-xl bg-slate-50 p-4">
                  <p className="text-xs leading-5 text-slate-600">This is a frontend preview. Retrieving an official report requires farmer sign-in and an authorized farm record. This form does not fetch or create a soil report yet.</p>
                </div>
              </section>
            )}

           
            {activeNav === 'Soil Reports' && (
              selectedReport ? (
                <SoilReportDetails
                  report={selectedReport}
                  onBack={() => setSelectedReport(null)}
                />
              ) : (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">Soil Report History</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Reports linked to your authorized farm.
                      </p>
                    </div>
                    <button
                      onClick={() => openPage('Check Soil Health')}
                      className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Find a report
                    </button>
                  </div>

                  <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                    <FileText size={36} className="mb-3 text-slate-400" />
                    <h4 className="font-semibold text-slate-800">
                      No soil reports to display
                    </h4>
                    <p className="mt-2 text-sm text-slate-500">
                      Your report history will appear here when authenticated API access is available.
                    </p>
                  </div>
                </section>
              )
            )}


            {activeNav === 'Input Verification' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-8">
                <div className="mb-4 flex items-center gap-3"><TestTube className="text-green-700" size={28} /><h3 className="font-bold text-slate-900">Agricultural Input Verification</h3></div>
                <p className="text-sm leading-6 text-slate-500">The product verification form and official verification results will be developed in Phase 3.</p>
              </section>
            )}

            <footer className="flex flex-col justify-between gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400 sm:flex-row">
              <span>AgriVoice · Soil Health &amp; Input Management</span>
              <span>Frontend development preview</span>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
