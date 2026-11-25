import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { changeAppLanguage, i18nReady } from '../app/providers/i18n';
import { isValidE164Phone, normalizeIndianPhone } from '../services/authService';

describe('AgriVoice Frontend Workflows', () => {
  beforeEach(async () => {
    await i18nReady;
    await changeAppLanguage('en');
  });

  it('renders landing page, supports mobile menu toggle, and switches languages', async () => {
    render(<App initialRoute="/" />);

    expect(screen.getByText(/Better farming decisions/i)).toBeInTheDocument();
    expect(screen.getByText('Weather & Crop Advisory', { selector: 'h3' })).toBeInTheDocument();
    expect(screen.getByText('Soil Health & Input Verification', { selector: 'h3' })).toBeInTheDocument();
    expect(screen.getByText('AI Voice Assistance', { selector: 'h3' })).toBeInTheDocument();

    const toggleBtn = screen.getByRole('button', { name: /Toggle navigation/i });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    const langSelect = screen.getByLabelText(/Select application language/i);
    fireEvent.change(langSelect, { target: { value: 'ur' } });
    await waitFor(() => {
      expect(document.documentElement.dir).toBe('rtl');
    });
  });

  it('normalizes Indian mobile numbers and signs in via Demo Farmer Mode to Unified Dashboard', async () => {
    expect(normalizeIndianPhone('9876543210')).toBe('+919876543210');
    expect(isValidE164Phone('+919876543210')).toBe(true);
    expect(isValidE164Phone('12345')).toBe(false);

    render(<App initialRoute="/login" />);

    fireEvent.click(screen.getByRole('button', { name: /Continue as Demo Farmer/i }));

    await waitFor(() => {
      expect(screen.getByText(/Welcome back, Ramesh Kumar/i)).toBeInTheDocument();
    });
    expect(screen.getByText('29.4°C')).toBeInTheDocument();
    expect(screen.getByText('pH 7.5')).toBeInTheDocument();
  });

  it('integrates Weather & Crop Advisory daily/hourly tabs and category filter', async () => {
    render(<App initialRoute="/login" />);
    fireEvent.click(screen.getByRole('button', { name: /Continue as Demo Farmer/i }));

    await waitFor(() => {
      expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Weather & Crop Advisory' }));
    await waitFor(() => {
      expect(screen.getByRole('region', { name: /Current Farm Conditions/i })).toBeInTheDocument();
    });

    const hourlyTab = screen.getByRole('tab', { name: /48-Hour Hourly/i });
    fireEvent.click(hourlyTab);
    expect(hourlyTab).toHaveAttribute('aria-selected', 'true');

    const categorySelect = screen.getByLabelText(/Filter by Category/i);
    fireEvent.change(categorySelect, { target: { value: 'irrigation' } });
    await waitFor(() => {
      expect(screen.getByText(/Maintain 2-3 cm standing water/i)).toBeInTheDocument();
    });
  });

  it('preserves untested soil nutrients as Not tested and runs input verification', async () => {
    render(<App initialRoute="/login" />);
    fireEvent.click(screen.getByRole('button', { name: /Continue as Demo Farmer/i }));
    await waitFor(() => expect(screen.getByText(/Welcome back/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Soil Health' }));
    await waitFor(() => {
      expect(screen.getByText(/Latest Soil Report: SHC-AP-1001/i)).toBeInTheDocument();
    });
    expect(screen.getByText('Not tested')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Input Verification/i }));
    fireEvent.change(screen.getByLabelText(/Product Name/i), {
      target: { value: 'BioSeed Paddy Gold' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Verify Product/i }));

    await waitFor(() => {
      expect(screen.getByText('BioSeed Paddy Gold', { selector: 'h3' })).toBeInTheDocument();
    });
  });

  it('opens AI Voice Assistance drawer and grounds responses via voice service', async () => {
    render(<App initialRoute="/" />);

    fireEvent.click(screen.getByRole('button', { name: /Voice Assistant/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /Summarize my latest Soil Health Card/i })
    );

    await waitFor(() => {
      expect(screen.getByText(/Soil Card SHC-AP-1001/i)).toBeInTheDocument();
    });
  });

  it('calls live Pillar 3 and Pillar 6 backend endpoints when signed in with a JWT', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/weather/dashboard')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                farmId: 'f1',
                farmName: 'Live Guntur Farm',
                currentWeather: {
                  temperature: 31,
                  humidity: 60,
                  rainfall: 0,
                  windSpeed: 8,
                  dataStatus: 'live',
                },
                todayForecast: { high: 33, low: 24, rainfallProb: 10 },
                advisories: [],
                lastUpdated: new Date().toISOString(),
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        );
      }
      if (url.endsWith('/weather/alerts')) {
        return Promise.resolve(
          new Response(JSON.stringify({ data: { alerts: [] } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        );
      }
      if (url.endsWith('/soil/dashboard')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                hasReport: false,
                latestReport: null,
                summary: {
                  totalReports: 0,
                  lastTestedDate: null,
                  primarySoilType: null,
                  overallStatus: 'NOT_REQUESTED',
                  availableNutrientCount: 0,
                  criticalDeficiencies: [],
                },
                recentReports: [],
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        );
      }
      return Promise.resolve(new Response('{}', { status: 404 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App initialRoute="/login" />);
    fireEvent.click(screen.getByRole('button', { name: /Have a Backend Dev JWT Token/i }));
    fireEvent.change(screen.getByLabelText(/Bearer JWT Token/i), {
      target: { value: 'header.eyJpZCI6InUxIiwicGhvbmUiOiIrOTE5ODc2NTQzMjAxIn0.sig' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Connect with JWT Token/i }));

    await waitFor(() => {
      expect(screen.getByText('Live Guntur Farm')).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/weather/dashboard'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining('Bearer '),
        }),
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/soil/dashboard'),
      expect.any(Object)
    );

    vi.unstubAllGlobals();
  });
});
