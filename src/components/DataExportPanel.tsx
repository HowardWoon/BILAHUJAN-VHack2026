import { useState, FC } from 'react';
import { 
  exportDataForGovernment, 
  generateCSVReport 
} from '../services/governmentAnalytics';

/**
 * Data Export Panel for Government Officials
 * Allows exporting anonymized flood data in various formats
 */

export const DataExportPanel: FC = () => {
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [loading, setLoading] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<'json' | 'csv' | null>(null);

  const handleExportJSON = async () => {
    setLoading(true);
    setExportStatus('Preparing JSON export...');
    
    try {
      const data = await exportDataForGovernment(
        new Date(startDate),
        new Date(endDate)
      );

      const blob = new Blob(
        [JSON.stringify(data, null, 2)],
        { type: 'application/json' }
      );
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bilahujan-data-${startDate}-to-${endDate}.json`;
      a.click();
      
      window.URL.revokeObjectURL(url);
      setExportStatus('JSON export complete!');
    } catch (error) {
      console.error('Export error:', error);
      setExportStatus('Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    setLoading(true);
    setExportStatus('Preparing CSV export...');
    
    try {
      const csv = await generateCSVReport(
        new Date(startDate),
        new Date(endDate)
      );

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bilahujan-report-${startDate}-to-${endDate}.csv`;
      a.click();
      
      window.URL.revokeObjectURL(url);
      setExportStatus('CSV export complete!');
    } catch (error) {
      console.error('Export error:', error);
      setExportStatus('Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openConfirmation = (format: 'json' | 'csv') => {
    if (loading) return;
    setPendingFormat(format);
    setConfirmOpen(true);
  };

  const closeConfirmation = () => {
    if (loading) return;
    setConfirmOpen(false);
    setPendingFormat(null);
  };

  const confirmExport = async () => {
    if (!pendingFormat) return;
    setConfirmOpen(false);
    if (pendingFormat === 'json') {
      await handleExportJSON();
      return;
    }
    await handleExportCSV();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <span className="material-icons-round text-blue-500">cloud_download</span>
        Data Export
      </h2>

      <div className="space-y-4">
        {/* Date Range Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => openConfirmation('json')}
            disabled={loading}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <span className="material-icons-round text-xl">code</span>
            Export as JSON
          </button>

          <button
            onClick={() => openConfirmation('csv')}
            disabled={loading}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <span className="material-icons-round text-xl">table_chart</span>
            Export as CSV
          </button>
        </div>

        {/* Status Message */}
        {exportStatus && (
          <div className={`p-4 rounded-lg ${
            exportStatus.includes('failed') 
              ? 'bg-red-50 text-red-700' 
              : exportStatus.includes('complete')
              ? 'bg-green-50 text-green-700'
              : 'bg-blue-50 text-blue-700'
          }`}>
            <p className="font-medium">{exportStatus}</p>
          </div>
        )}

        {/* Data Privacy Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
          <div className="flex gap-2">
            <span className="material-icons-round text-blue-500 text-xl">shield</span>
            <div>
              <p className="font-semibold text-blue-900 mb-1">Privacy Compliant Data</p>
              <p className="text-sm text-blue-700">
                All exported data is anonymized and contains no personal information. 
                Suitable for government analysis, planning, and research purposes.
              </p>
            </div>
          </div>
        </div>

        {/* Data Includes */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="font-semibold text-gray-800 mb-2">Exported Data Includes:</p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>✓ Flood incident statistics and trends</li>
            <li>✓ Location-based analytics (by area, not individual users)</li>
            <li>✓ Infrastructure performance metrics</li>
            <li>✓ Weather correlation data</li>
            <li>✓ Drainage system efficiency</li>
            <li>✓ Historical flood patterns</li>
          </ul>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-[2rem] overflow-hidden shadow-2xl">
            <div className="bg-[#0f172a] px-6 py-8 relative">
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
                  backgroundSize: '16px 16px'
                }}
              ></div>
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center mb-5">
                  <span className="material-icons-round text-blue-300">file_download</span>
                </div>
                <h3 className="text-white text-3xl font-extrabold tracking-tight text-center">Confirm Data Export</h3>
              </div>
            </div>

            <div className="px-8 py-8">
              <p className="text-center text-slate-600 text-[28px] leading-relaxed mb-6">
                You are about to export anonymized flood monitoring data for the selected period.
              </p>

              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-6">
                <p className="text-blue-700 font-bold text-lg leading-relaxed text-center">
                  This data is privacy-compliant and secured for government use.
                </p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={confirmExport}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold text-2xl shadow-lg shadow-blue-200/60 transition-all active:scale-95"
                >
                  Confirm Export
                </button>
                <button
                  onClick={closeConfirmation}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-2xl font-bold text-2xl transition-all active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
