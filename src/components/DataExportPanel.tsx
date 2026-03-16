import { FC, useState } from 'react';
import { get, ref } from 'firebase/database';
import { rtdb } from '../firebase';
import { exportDataForGovernment } from '../services/governmentAnalytics';

const toCsvCell = (value: unknown): string => {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const buildCSVFromExport = (payload: any): string => {
  const rows: string[] = [];

  rows.push('SECTION,KEY,VALUE');
  rows.push(`Summary,Total Incidents,${toCsvCell(payload.statistics?.totalIncidents ?? 0)}`);
  rows.push(`Summary,Average Severity,${toCsvCell((payload.statistics?.averageSeverity ?? 0).toFixed?.(2) ?? payload.statistics?.averageSeverity ?? 0)}`);
  rows.push(`Summary,Affected Areas,${toCsvCell(payload.statistics?.affectedAreas ?? 0)}`);
  rows.push(`Summary,Most Affected Region,${toCsvCell(payload.statistics?.mostAffectedRegion ?? 'N/A')}`);
  rows.push('');

  rows.push('LOCATION ANALYTICS');
  rows.push('Location,State,Incident Count,Avg Severity,Avg Water Level,Avg Drainage Blockage,Last Incident');
  (payload.locationAnalytics ?? []).forEach((location: any) => {
    rows.push(
      [
        toCsvCell(location.location),
        toCsvCell(location.state),
        toCsvCell(location.incidentCount),
        toCsvCell(Number(location.avgSeverity ?? 0).toFixed(1)),
        toCsvCell(Number(location.avgWaterLevel ?? 0).toFixed(1)),
        toCsvCell(Number(location.avgDrainageBlockage ?? 0).toFixed(1)),
        toCsvCell(location.lastIncident ?? '')
      ].join(',')
    );
  });
  rows.push('');

  rows.push('INFRASTRUCTURE INSIGHTS');
  rows.push(`Drainage Efficiency,${toCsvCell(payload.infrastructure?.drainageEfficiency ?? 0)}%`);
  rows.push(`Critical Zones,${toCsvCell((payload.infrastructure?.criticalZones ?? []).join('; '))}`);
  rows.push(`Maintenance Needed,${toCsvCell((payload.infrastructure?.maintenanceNeeded ?? []).join('; '))}`);
  rows.push(`Average Response Time,${toCsvCell(payload.infrastructure?.responseTime ?? 0)} minutes`);
  rows.push('');

  rows.push('MISSION LOGS');
  rows.push('Mission ID,Status,Start Time,End Time,Zones Actioned,Alerts Dispatched,Summary');
  (payload.missionLogs ?? []).forEach((mission: any) => {
    rows.push(
      [
        toCsvCell(mission.missionId),
        toCsvCell(mission.status),
        toCsvCell(mission.startTime),
        toCsvCell(mission.endTime),
        toCsvCell(mission.zonesActioned),
        toCsvCell(mission.alertsDispatched),
        toCsvCell(mission.summary)
      ].join(',')
    );
  });

  return rows.join('\n');
};

export const DataExportPanel: FC = () => {
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null);
  const [exportStatus, setExportStatus] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<'json' | 'csv' | null>(null);

  const buildPayload = async () => {
    const data = await exportDataForGovernment(new Date(startDate), new Date(endDate));
    const missionSnap = await get(ref(rtdb, 'missionLogs'));
    const missions = missionSnap.exists() ? Object.values(missionSnap.val()) : [];

    return {
      ...data,
      missionLogs: missions,
      exportInfo: {
        platform: 'BILAHUJAN V Hack 2026',
        exportDate: new Date().toISOString(),
        privacyCompliant: true,
        dataSource: 'Firebase Realtime Database + Firestore'
      }
    };
  };

  const handleExportJSON = async () => {
    try {
      setExporting('json');
      setExportStatus('Preparing JSON export...');

      const exportPayload = await buildPayload();
      const filenameDate = new Date().toISOString().split('T')[0];

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bilahujan_flood_data_${filenameDate}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportStatus('JSON export complete!');
    } catch (error) {
      console.error('JSON export failed:', error);
      setExportStatus('Export failed. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  const handleExportCSV = async () => {
    try {
      setExporting('csv');
      setExportStatus('Preparing CSV export...');

      const exportPayload = await buildPayload();
      const csv = buildCSVFromExport(exportPayload);
      const filenameDate = new Date().toISOString().split('T')[0];

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bilahujan_flood_data_${filenameDate}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportStatus('CSV export complete!');
    } catch (error) {
      console.error('CSV export failed:', error);
      setExportStatus('Export failed. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  const openConfirmation = (format: 'json' | 'csv') => {
    if (exporting) {
      return;
    }
    setPendingFormat(format);
    setConfirmOpen(true);
  };

  const closeConfirmation = () => {
    if (exporting) {
      return;
    }
    setConfirmOpen(false);
    setPendingFormat(null);
  };

  const confirmExport = async () => {
    if (!pendingFormat) {
      return;
    }

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => openConfirmation('json')}
            disabled={!!exporting}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {exporting === 'json' ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Exporting JSON...
              </>
            ) : (
              <>
                <span className="material-icons-round text-xl">code</span>
                Export as JSON
              </>
            )}
          </button>

          <button
            onClick={() => openConfirmation('csv')}
            disabled={!!exporting}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {exporting === 'csv' ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Exporting CSV...
              </>
            ) : (
              <>
                <span className="material-icons-round text-xl">table_chart</span>
                Export as CSV
              </>
            )}
          </button>
        </div>

        {exportStatus && (
          <div
            className={`p-4 rounded-lg ${
              exportStatus.includes('failed')
                ? 'bg-red-50 text-red-700'
                : exportStatus.includes('complete')
                ? 'bg-green-50 text-green-700'
                : 'bg-blue-50 text-blue-700'
            }`}
          >
            <p className="font-medium">{exportStatus}</p>
          </div>
        )}

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

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="font-semibold text-gray-800 mb-2">Exported Data Includes:</p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>✓ Flood incident statistics and trends</li>
            <li>✓ Location analytics by hotspot and state</li>
            <li>✓ Infrastructure and drainage metrics</li>
            <li>✓ Mission logs and response outcomes</li>
          </ul>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-5">
          <div className="w-[calc(100vw-2.75rem)] max-w-[320px] sm:max-w-[380px] bg-white rounded-[1.75rem] sm:rounded-[2rem] overflow-hidden shadow-2xl max-h-[calc(100dvh-4rem)] sm:max-h-[92vh] flex flex-col">
            <div className="bg-[#0f172a] px-4 py-5 sm:px-6 sm:py-8 relative">
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
                  backgroundSize: '16px 16px'
                }}
              />
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center mb-3 sm:mb-5">
                  <span className="material-icons-round text-[20px] sm:text-2xl text-blue-300">file_download</span>
                </div>
                <h3 className="text-white text-[1.75rem] sm:text-3xl leading-tight font-extrabold tracking-tight text-center">Confirm Data Export</h3>
              </div>
            </div>

            <div className="px-4 sm:px-8 py-4 sm:py-8 overflow-y-auto">
              <p className="text-center text-slate-600 text-sm sm:text-base leading-relaxed mb-4 sm:mb-6">
                You are about to export anonymized flood monitoring data for the selected period.
              </p>

              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3.5 sm:p-5 mb-4 sm:mb-6">
                <p className="text-blue-700 font-bold text-[13px] sm:text-sm leading-relaxed text-center">
                  This data is privacy-compliant and secured for government use.
                </p>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <button
                  onClick={confirmExport}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl font-bold text-[15px] sm:text-base shadow-lg shadow-blue-200/60 transition-all active:scale-95"
                >
                  Confirm Export
                </button>
                <button
                  onClick={closeConfirmation}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-2xl font-bold text-[15px] sm:text-base transition-all active:scale-95"
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
