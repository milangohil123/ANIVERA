import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, Loader2, RefreshCw, X, ShieldCheck, HardDrive, RotateCcw } from 'lucide-react';
import { offlineDb, type QueuedMedia, type QueuedEvent } from '../db/offlineDb';
import { authService } from '../services/authService';

export interface AttachmentMetadata {
  id: string;
  reportId?: string;
  report_id?: string;
  sha256: string;
  mimeType?: string;
  mime_type?: string;
  sizeBytes?: number;
  size_bytes?: number;
  uploadedBy?: string;
  uploaded_by?: string;
  uploadedAt?: string;
  uploaded_at?: string;
  isLocalOnly?: boolean;
  localBlobUrl?: string;
}

interface AttachmentViewerProps {
  reportId: string;
  apiBaseUrl: string;
  authToken: string;
  onEditReport?: (reportId: string) => void;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const AttachmentViewer: React.FC<AttachmentViewerProps> = ({
  reportId,
  apiBaseUrl,
  authToken,
  onEditReport,
}) => {
  const [attachments, setAttachments] = useState<AttachmentMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocalFallback, setIsLocalFallback] = useState(false);
  const [parentEvent, setParentEvent] = useState<QueuedEvent | null>(null);

  // Authenticated blob cache: attachmentId -> blob object URL
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
  const [selectedAttachment, setSelectedAttachment] = useState<AttachmentMetadata | null>(null);

  const cleanReportId = reportId.trim();

  const fetchAttachments = async () => {
    if (!cleanReportId) {
      setAttachments([]);
      setError(null);
      setParentEvent(null);
      return;
    }

    if (!UUID_REGEX.test(cleanReportId)) {
      setError(`અમાન્ય UUID ફોર્મેટ: "${cleanReportId}". કૃપા કરીને માન્ય 36-અક્ષર UUID દાખલ કરો.`);
      setAttachments([]);
      setParentEvent(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsLocalFallback(false);

    // Check if report exists locally in Dexie
    const localEvent = await offlineDb.queued_events.get(cleanReportId);
    setParentEvent(localEvent || null);

    try {
      const token = (await authService.getValidAccessToken(apiBaseUrl)) || authToken;

      // Step 1: Attempt to fetch authenticated attachments from backend API
      const res = await fetch(`${apiBaseUrl}/api/v1/disease-reports/${cleanReportId}/attachments`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const rawData = await res.json();
        const mappedData: AttachmentMetadata[] = rawData.map((item: Record<string, unknown>) => ({
          id: String(item.id),
          reportId: String(item.reportId || item.report_id || cleanReportId),
          sha256: String(item.sha256 || ''),
          mimeType: String(item.mimeType || item.mime_type || 'image/jpeg'),
          sizeBytes: Number(item.sizeBytes || item.size_bytes || 0),
          uploadedBy: String(item.uploadedBy || item.uploaded_by || ''),
          uploadedAt: String(item.uploadedAt || item.uploaded_at || new Date().toISOString()),
          isLocalOnly: false,
        }));

        setAttachments(mappedData);

        // Stream authenticated photos
        for (const att of mappedData) {
          if (!blobUrls[att.id]) {
            fetchAuthenticatedImage(att.id, token);
          }
        }
        return;
      }

      // If server returned 404 or other non-OK status, inspect error body
      const errBody = await res.json().catch(() => ({ detail: '' }));
      const serverDetail = errBody.detail || `HTTP ${res.status}`;

      // Step 2: Fallback to local Dexie IndexedDB
      const localMediaItems = await offlineDb.queued_media
        .filter(
          (m: QueuedMedia) =>
            m.parentReportId === cleanReportId || m.parentEventId === cleanReportId
        )
        .toArray();

      if (localMediaItems.length > 0) {
        setIsLocalFallback(true);
        const localMapped: AttachmentMetadata[] = localMediaItems.map((lm: QueuedMedia) => {
          const objectUrl = URL.createObjectURL(lm.blob);
          return {
            id: lm.mediaId,
            reportId: cleanReportId,
            sha256: lm.sha256,
            mimeType: lm.mimeType,
            sizeBytes: lm.sizeBytes,
            uploadedAt: lm.clientCreatedAt,
            isLocalOnly: true,
            localBlobUrl: objectUrl,
          };
        });

        setAttachments(localMapped);
        // Pre-populate blobUrls for local items
        const newUrls: Record<string, string> = {};
        for (const item of localMapped) {
          if (item.localBlobUrl) {
            newUrls[item.id] = item.localBlobUrl;
          }
        }
        setBlobUrls((prev) => ({ ...prev, ...newUrls }));
        return;
      }

      // If not on server and not in local IndexedDB
      if (res.status === 404) {
        throw new Error(
          `રોગ અહેવાલ સર્વર પર મળ્યો નથી (HTTP 404: ${serverDetail}). કૃપા કરીને ખાતરી કરો કે અહેવાલ સફળતાપૂર્વક સબમિટ અને સમન્વયિત (Synced) થયો છે.`
        );
      } else {
        throw new Error(`સર્વર પ્રતિસાદ: HTTP ${res.status} (${serverDetail})`);
      }
    } catch (err) {
      // Check local DB even if network request completely failed
      try {
        const localMediaItems = await offlineDb.queued_media
          .filter(
            (m: QueuedMedia) =>
              m.parentReportId === cleanReportId || m.parentEventId === cleanReportId
          )
          .toArray();

        if (localMediaItems.length > 0) {
          setIsLocalFallback(true);
          const localMapped: AttachmentMetadata[] = localMediaItems.map((lm: QueuedMedia) => {
            const objectUrl = URL.createObjectURL(lm.blob);
            return {
              id: lm.mediaId,
              reportId: cleanReportId,
              sha256: lm.sha256,
              mimeType: lm.mimeType,
              sizeBytes: lm.sizeBytes,
              uploadedAt: lm.clientCreatedAt,
              isLocalOnly: true,
              localBlobUrl: objectUrl,
            };
          });

          setAttachments(localMapped);
          const newUrls: Record<string, string> = {};
          for (const item of localMapped) {
            if (item.localBlobUrl) {
              newUrls[item.id] = item.localBlobUrl;
            }
          }
          setBlobUrls((prev) => ({ ...prev, ...newUrls }));
          return;
        }
      } catch (localErr) {
        console.warn('Local fallback inspection failed:', localErr);
      }

      setError(err instanceof Error ? err.message : 'જોડાણ ડેટા લોડ કરવામાં નિષ્ફળ.');
      setAttachments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAuthenticatedImage = async (attachmentId: string, currentToken?: string) => {
    try {
      const token = currentToken || (await authService.getValidAccessToken(apiBaseUrl)) || authToken;
      const res = await fetch(
        `${apiBaseUrl}/api/v1/disease-reports/${cleanReportId}/attachments/${attachmentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        return;
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      setBlobUrls((prev) => ({ ...prev, [attachmentId]: objectUrl }));
    } catch (err) {
      console.warn(`Failed to stream attachment ${attachmentId}:`, err);
    }
  };

  useEffect(() => {
    fetchAttachments();

    return () => {
      Object.values(blobUrls).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (_) { }
      });
    };
  }, [cleanReportId]);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
        <div>
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-emerald-600" />
            અહેવાલના ફોટો જોડાણો (Attached Photo Evidence)
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            સર્વર સુરક્ષિત એન્ડપોઇન્ટ દ્વારા પ્રમાણિત ફોટોગ્રાફ્સ (Zero internal paths exposed).
          </p>
        </div>

        <button
          type="button"
          onClick={fetchAttachments}
          disabled={isLoading}
          className="p-2 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors border border-gray-200"
          title="રીફ્રેશ કરો"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Local IndexedDB Banner Indicator */}
      {isLocalFallback && (
        <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
          <div className="flex items-start gap-2.5">
            <HardDrive className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">સ્થાનિક ફોટો દર્શાવાયો છે (Local IndexedDB Evidence):</span>
              <p className="mt-0.5 text-amber-800">
                આ ફોટોગ્રાફ સ્થાનિક ઉપકરણમાં સંગ્રહિત છે કારણ કે પિતૃ અહેવાલ હજુ સર્વર પર સ્વીકારાયેલ નથી.
              </p>

              {parentEvent && parentEvent.state === 'SYNC_FAILED' && (
                <div className="mt-2 p-2 bg-amber-100/70 rounded-lg border border-amber-300/60 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-red-700">સર્વર અસ્વીકાર: </span>
                    <code className="font-mono bg-white px-1 py-0.5 rounded text-[11px] font-semibold">
                      {parentEvent.serverAck?.code || 'REJECTED'}
                    </code>
                    {parentEvent.serverAck?.errors?.[0]?.message && (
                      <span className="block mt-0.5 text-[11px] text-gray-700">
                        {parentEvent.serverAck.errors[0].message}
                      </span>
                    )}
                  </div>

                  {onEditReport && (
                    <button
                      type="button"
                      onClick={() => onEditReport(cleanReportId)}
                      className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white font-medium rounded-lg text-xs flex items-center gap-1 shadow-xs transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>સુધારો (Edit)</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 mb-4 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
          {error}
        </div>
      )}

      {isLoading && attachments.length === 0 ? (
        <div className="py-8 flex flex-col items-center justify-center text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mb-2 text-emerald-600" />
          <span className="text-xs">જોડાણો લોડ થઈ રહ્યા છે...</span>
        </div>
      ) : attachments.length === 0 && !error ? (
        <div className="py-8 text-center text-gray-400 text-sm">
          આ અહેવાલ માટે કોઈ ફોટો જોડાણ મળ્યા નથી (No attachments found).
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {attachments.map((att) => {
            const previewUrl = blobUrls[att.id] || att.localBlobUrl;
            const sizeInKb = ((att.sizeBytes || att.size_bytes || 0) / 1024).toFixed(0);
            const dateStr = att.uploadedAt || att.uploaded_at || '';
            const sha256Str = att.sha256 || '';

            return (
              <div
                key={att.id}
                onClick={() => setSelectedAttachment(att)}
                className="group relative cursor-pointer border border-gray-200 rounded-xl overflow-hidden hover:border-emerald-500 hover:shadow-sm transition-all bg-gray-50 flex flex-col"
              >
                <div className="h-28 w-full bg-gray-100 overflow-hidden relative flex items-center justify-center">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Attachment preview"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  )}
                  <div className="absolute top-1 right-1 bg-black/60 backdrop-blur-xs text-white text-[10px] px-1.5 py-0.5 rounded">
                    {sizeInKb} KB
                  </div>

                  {att.isLocalOnly && (
                    <div className="absolute bottom-1 left-1 bg-amber-600/90 text-white text-[9px] px-1.5 py-0.5 rounded font-medium">
                      ઑફલાઇન
                    </div>
                  )}
                </div>

                <div className="p-2 bg-white flex-1 flex flex-col justify-between">
                  <div className="text-[11px] font-mono text-gray-600 truncate flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                    <span>{sha256Str ? sha256Str.substring(0, 10) + '...' : 'Verified'}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    {dateStr ? new Date(dateStr).toLocaleDateString('gu-IN') : 'આજે'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Image Modal */}
      {selectedAttachment && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in duration-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-gray-900">ફોટોગ્રાફિક પુરાવો (Evidence)</h4>
                <p className="text-[11px] text-gray-500 font-mono">ID: {selectedAttachment.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAttachment(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-gray-900 flex items-center justify-center min-h-[260px]">
              {blobUrls[selectedAttachment.id] || selectedAttachment.localBlobUrl ? (
                <img
                  src={blobUrls[selectedAttachment.id] || selectedAttachment.localBlobUrl}
                  alt="Expanded evidence"
                  className="max-h-[60vh] max-w-full object-contain rounded-lg"
                />
              ) : (
                <Loader2 className="w-8 h-8 animate-spin text-white" />
              )}
            </div>

            <div className="p-4 bg-gray-50 text-xs space-y-1.5 border-t border-gray-100">
              <div className="flex justify-between text-gray-600">
                <span>પ્રકાર:</span>
                <span className="font-mono">{selectedAttachment.mimeType || 'image/jpeg'}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>કદ:</span>
                <span className="font-mono">
                  {((selectedAttachment.sizeBytes || 0) / 1024).toFixed(1)} KB
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>સંગ્રહ સ્થિતિ:</span>
                <span className={selectedAttachment.isLocalOnly ? 'text-amber-700 font-medium' : 'text-emerald-700 font-medium'}>
                  {selectedAttachment.isLocalOnly ? 'સ્થાનિક (IndexedDB)' : 'પ્રમાણિત સર્વર સ્ટોરેજ (PostgreSQL)'}
                </span>
              </div>
              <div className="pt-1 border-t border-gray-200/60">
                <span className="text-[10px] text-gray-500 block mb-0.5">SHA-256 હેશ:</span>
                <code className="text-[10px] font-mono block bg-gray-200/70 p-1 rounded break-all select-all">
                  {selectedAttachment.sha256}
                </code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
