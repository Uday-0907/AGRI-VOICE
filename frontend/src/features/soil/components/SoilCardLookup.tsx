
import { useState, type FormEvent } from 'react';
import { Search, LoaderCircle, AlertCircle } from 'lucide-react';

type SoilCardLookupProps = {
  onLookup: (cardId: string) => void | Promise<void>;
  loading?: boolean;
};

export default function SoilCardLookup({
  onLookup,
  loading = false,
}: SoilCardLookupProps) {
  const [cardId, setCardId] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedId = cardId.trim();

    if (!trimmedId) {
      setError('Please enter your Soil Health Card ID.');
      return;
    }

    setError('');
    await onLookup(trimmedId);
  }

  return (
    <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">
        Soil Health Card Lookup
      </h2>

      <p className="mt-1 mb-5 text-sm text-slate-500">
        Enter your Soil Health Card ID to request your report.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <label
          htmlFor="soil-card-id"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Soil Health Card ID
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="soil-card-id"
            value={cardId}
            onChange={(event) => {
              setCardId(event.target.value);
              setError('');
            }}
            placeholder="Enter your card ID"
            disabled={loading}
            className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
          />

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60"
          >
            {loading ? (
              <>
                <LoaderCircle size={18} className="animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search size={18} />
                Search report
              </>
            )}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-red-700">
            <AlertCircle size={16} />
            {error}
          </p>
        )}

        <p className="mt-3 text-xs text-slate-500">
          Secure sign-in and farm ownership verification are required to
          retrieve an official report.
        </p>
      </form>
    </section>
  );
}
