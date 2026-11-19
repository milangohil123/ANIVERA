import React, { useState } from 'react';
import { generateQrSvgString, generateQrDataUrl } from '../../utils/qrGenerator';
import { Button } from './Button';
import { Printer, Download, Copy, Check, QrCode, ShieldCheck, Image as ImageIcon } from 'lucide-react';

interface AnimalQrCardProps {
  token: string;
  animalCode?: string | null;
  speciesCode?: string | null;
  sex?: string | null;
  tagNumber?: string | null;
  farmerName?: string | null;
  villageName?: string | null;
  showPrintActions?: boolean;
}

export const AnimalQrCard: React.FC<AnimalQrCardProps> = ({
  token,
  animalCode,
  speciesCode,
  sex,
  tagNumber,
  farmerName,
  villageName,
  showPrintActions = true,
}) => {
  const [copied, setCopied] = useState(false);

  const svgString = React.useMemo(() => {
    return generateQrSvgString(token, 240);
  }, [token]);

  const handleCopyToken = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>PashuRakshak Botad — Animal QR Pass (${animalCode || token})</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 90vh;
            background: #fff;
          }
          .card {
            border: 2px solid #0f766e;
            border-radius: 16px;
            padding: 24px;
            max-width: 380px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          .title {
            color: #0f766e;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 4px;
          }
          .sub {
            color: #64748b;
            font-size: 12px;
            margin-bottom: 16px;
          }
          .qr-box {
            display: inline-block;
            margin: 12px 0;
            padding: 8px;
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
          }
          .info {
            text-align: left;
            margin-top: 16px;
            font-size: 13px;
            border-top: 1px dashed #cbd5e1;
            padding-top: 12px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 6px;
          }
          .label { color: #64748b; }
          .val { font-weight: bold; color: #1e293b; }
          .token-box {
            font-family: monospace;
            background: #f1f5f9;
            padding: 6px;
            border-radius: 6px;
            font-size: 11px;
            word-break: break-all;
            margin-top: 10px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="title">પશુરક્ષક બોટાદ — પશુ ઓળખ પાસ</div>
          <div class="sub">Livestock Digital Health & Vaccination Tag</div>
          <div class="qr-box">
            ${svgString}
          </div>
          <div class="info">
            <div class="info-row">
              <span class="label">પશુ કોડ:</span>
              <span class="val">${animalCode || '—'}</span>
            </div>
            ${tagNumber ? `<div class="info-row"><span class="label">ભારત પશુધન ૧૨-અંક:</span><span class="val">${tagNumber}</span></div>` : ''}
            <div class="info-row">
              <span class="label">જાતિ / લિંગ:</span>
              <span class="val">${speciesCode || 'CATTLE'} • ${sex === 'F' ? 'માદા' : sex === 'M' ? 'નર' : 'અજ્ઞાત'}</span>
            </div>
            ${farmerName ? `<div class="info-row"><span class="label">પશુપાલક:</span><span class="val">${farmerName}</span></div>` : ''}
            ${villageName ? `<div class="info-row"><span class="label">ગામ:</span><span class="val">${villageName}</span></div>` : ''}
          </div>
          <div class="token-box">
            ટોકન: ${token}
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadSvg = () => {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PASHU_QR_${animalCode || token}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPng = () => {
    const dataUrl = generateQrDataUrl(token, 400);
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `PASHU_QR_${animalCode || token}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-[#135D43]/20 p-4 shadow-sm space-y-4">
      {/* Header Banner */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#135D43] flex items-center justify-center font-bold">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#1E293B]">સત્તાવાર પશુ QR કોડ (Official Animal QR)</h4>
            <p className="text-[10px] text-[#64748B]">કેમેરા સ્કેનર અથવા પશુરક્ષક સ્કેન મોડ વડે સ્કેન કરો</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          <ShieldCheck className="w-3 h-3" />
          સક્રિય
        </span>
      </div>

      {/* Visual QR Code Display */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
        <div
          className="w-44 h-44 bg-white p-2 rounded-xl shadow-xs border border-gray-200 flex items-center justify-center"
          dangerouslySetInnerHTML={{ __html: svgString }}
        />

        <div className="space-y-2 text-xs flex-1 w-full">
          <div>
            <span className="text-[#64748B] text-[10px]">પશુ કોડ:</span>
            <div className="font-bold text-[#1E293B] text-sm font-mono">{animalCode || '—'}</div>
          </div>

          {tagNumber && (
            <div>
              <span className="text-[#64748B] text-[10px]">ભારત પશુધન ૧૨-અંક ટેગ:</span>
              <div className="font-bold text-[#1E293B] font-mono">{tagNumber}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-[#64748B]">જાતિ / લિંગ:</span>
              <div className="font-medium text-[#1E293B]">
                {speciesCode || 'CATTLE'} • {sex === 'F' ? 'માદા' : sex === 'M' ? 'નર' : 'અજ્ઞાત'}
              </div>
            </div>
            {villageName && (
              <div>
                <span className="text-[#64748B]">ગામ:</span>
                <div className="font-medium text-[#1E293B]">{villageName}</div>
              </div>
            )}
          </div>

          {/* 26-char Base32 Cryptographic Token */}
          <div className="pt-1">
            <span className="text-[#64748B] text-[10px]">સક્રિય Base32 ટોકન:</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <code className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md flex-1 break-all select-all">
                {token}
              </code>
              <button
                type="button"
                onClick={handleCopyToken}
                className="p-1.5 text-xs text-[#64748B] hover:text-[#1E293B] bg-white border border-[#CBD5E1] rounded-md transition-colors"
                title="ટોકન કોપી કરો"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Print & Download Actions */}
      {showPrintActions && (
        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
          <Button variant="outline" size="sm" onClick={handleDownloadPng} leftIcon={<ImageIcon className="w-3.5 h-3.5" />}>
            PNG ઇમેજ ડાઉનલોડ
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadSvg} leftIcon={<Download className="w-3.5 h-3.5" />}>
            SVG ડાઉનલોડ
          </Button>
          <Button variant="primary" size="sm" onClick={handlePrint} leftIcon={<Printer className="w-3.5 h-3.5" />}>
            પ્રિન્ટ QR પાસ
          </Button>
        </div>
      )}
    </div>
  );
};

