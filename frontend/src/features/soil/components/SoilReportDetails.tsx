import { ArrowLeft, CalendarDays, FlaskConical, Leaf } from 'lucide-react';

export type SoilReport = {
  id: string;
  cardId: string;
  testDate: string;
  soilType?: string;
  ph?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  organicCarbon?: number;
  recommendations?: string[];
};

type Props = {
  report: SoilReport | null;
  onBack?: () => void;
};

export default function SoilReportDetails({ report, onBack }: Props) {
  if (!report) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <FlaskConical className="mx-auto mb-3 text-slate-400" size={38} />
        <h3 className="font-bold text-slate-900">No report selected</h3>
        <p className="mt-2 text-sm text-slate-500">
          Select a soil report from your report history to view its details.
          Your actual soil results will appear here when available.
        </p>
        {onBack && (
          <button onClick={onBack} className="mt-5 rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">
            Back to reports
          </button>
        )}
      </section>
    );
  }

  const measurements = [
    { label: 'Soil pH', value: report.ph, unit: '' },
    { label: 'Nitrogen', value: report.nitrogen, unit: ' kg/ha' },
    { label: 'Phosphorus', value: report.phosphorus, unit: ' kg/ha' },
    { label: 'Potassium', value: report.potassium, unit: ' kg/ha' },
    { label: 'Organic Carbon', value: report.organicCarbon, unit: '%' },
  ];

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-green-700">SOIL HEALTH REPORT</p>
          <h3 className="mt-1 text-xl font-bold text-slate-900">Report Details</h3>
        </div>
        {onBack && (
          <button onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
            <ArrowLeft size={16} /> Back
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500">Soil Health Card ID</p>
          <p className="mt-1 font-semibold text-slate-900">{report.cardId}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={14} /> Test Date</p>
          <p className="mt-1 font-semibold text-slate-900">{report.testDate}</p>
        </div>
        {report.soilType && (
          <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
            <p className="text-xs text-slate-500">Soil Type</p>
            <p className="mt-1 font-semibold text-slate-900">{report.soilType}</p>
          </div>
        )}
      </div>

      <div>
        <h4 className="mb-3 flex items-center gap-2 font-bold text-slate-900">
          <FlaskConical size={18} className="text-green-700" /> Soil Measurements
        </h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {measurements.map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{item.label}</p>
              <p className="mt-2 text-xl font-bold text-slate-900">
                {item.value == null ? 'Not available' : `${item.value}${item.unit}`}
              </p>
            </div>
          ))}
        </div>
      </div>

      {report.recommendations && report.recommendations.length > 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5">
          <h4 className="mb-3 flex items-center gap-2 font-bold text-green-900">
            <Leaf size={18} /> Recommendations
          </h4>
          <ul className="list-inside list-disc space-y-2 text-sm text-green-900">
            {report.recommendations.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Report values and recommendations must come from an authorized soil report.
      </p>
    </section>
  );
}
