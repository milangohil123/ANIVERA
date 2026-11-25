import React, { useState, useMemo } from 'react';
import { generateQrSvgString, generateQrDataUrl } from '../../utils/qrGenerator';
import { generateBarcodeSvgString } from '../../utils/barcodeGenerator';
import { Button } from './Button';
import {
  Printer,
  Download,
  Copy,
  Check,
  QrCode,
  Barcode as BarcodeIcon,
  ShieldCheck,
  Image as ImageIcon,
} from 'lucide-react';

export interface AnimalQrCardProps {
  token?: string | null;
  tagType?: 'QR' | 'BARCODE' | 'BOTH';
  barcodeValue?: string | null;
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
  tagType = 'QR',
  barcodeValue,
  animalCode,
  speciesCode,
  sex,
  tagNumber,
  farmerName,
  villageName,
  showPrintActions = true,
}) => {
  // Determine initial active view: if tagType is BARCODE, default to BARCODE; else QR
  const [activeFormat, setActiveFormat] = useState<'QR' | 'BARCODE'>(() => {
    if (tagType === 'BARCODE') return 'BARCODE';
    if (!token && (barcodeValue || tagNumber || animalCode)) return 'BARCODE';
    return 'QR';
  });

  const [copied, setCopied] = useState(false);

  // Effective barcode string to encode
  const effectiveBarcodeText = useMemo(() => {
    return barcodeValue || tagNumber || animalCode || token || 'ANM-000000';
  }, [barcodeValue, tagNumber, animalCode, token]);

  // Effective QR token
  const effectiveQrToken = useMemo(() => {
    return token || effectiveBarcodeText;
  }, [token, effectiveBarcodeText]);

  // Generate QR SVG
  const qrSvgString = useMemo(() => {
    return generateQrSvgString(effectiveQrToken, 240);
  }, [effectiveQrToken]);

  // Generate 1D Barcode SVG (horizontal rectangle with vertical lines)
  const barcodeSvgString = useMemo(() => {
    return generateBarcodeSvgString(effectiveBarcodeText, {
      barWidth: 2,
      barHeight: 80,
      quietZone: 24,
      showText: true,
      fontSize: 13,
      label: effectiveBarcodeText,
    });
  }, [effectiveBarcodeText]);

  const activeSvgString = activeFormat === 'BARCODE' ? barcodeSvgString : qrSvgString;
  const activeValueToCopy = activeFormat === 'BARCODE' ? effectiveBarcodeText : effectiveQrToken;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeValueToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const isBarcode = activeFormat === 'BARCODE';
    const titleText = isBarcode
      ? 'પશુરક્ષક બોટાદ — પશુ ૧D બારકોડ ઓળખ પાસ'
      : 'પશુરક્ષક બોટાદ — પશુ QR ઓળખ પાસ';
    const subText = isBarcode
      ? 'Official Livestock 1D Barcode Tag (Code 128)'
      : 'Livestock Digital Health & Vaccination Tag';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${titleText} (${animalCode || effectiveBarcodeText})</title>
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
            max-width: ${isBarcode ? '480px' : '380px'};
            width: 100%;
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
          .tag-box {
            display: inline-block;
            margin: 12px 0;
            padding: 12px;
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            max-width: 100%;
          }
          .tag-box svg {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 0 auto;
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
            letter-spacing: 1px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="title">${titleText}</div>
          <div class="sub">${subText}</div>
          <div class="tag-box">
            ${activeSvgString}
          </div>
          <div class="info">
            <div class="info-row">
              <span class="label">પશુ કોડ:</span>
              <span class="val">${animalCode || '—'}</span>
            </div>
            ${
              tagNumber
                ? `<div class="info-row"><span class="label">ભારત પશુધન ૧૨-અંક:</span><span class="val">${tagNumber}</span></div>`
                : ''
            }
            <div class="info-row">
              <span class="label">જાતિ / લિંગ:</span>
              <span class="val">${speciesCode || 'CATTLE'} • ${
                sex === 'F' ? 'માદા' : sex === 'M' ? 'નર' : 'અજ્ઞાત'
              }</span>
            </div>
            ${
              farmerName
                ? `<div class="info-row"><span class="label">પશુપાલક:</span><span class="val">${farmerName}</span></div>`
                : ''
            }
            ${
              villageName
                ? `<div class="info-row"><span class="label">ગામ:</span><span class="val">${villageName}</span></div>`
                : ''
            }
          </div>
          <div class="token-box">
            ${isBarcode ? `બારકોડ ID: ${effectiveBarcodeText}` : `ટોકન: ${effectiveQrToken}`}
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
    const isBarcode = activeFormat === 'BARCODE';
    const prefix = isBarcode ? 'PASHU_BARCODE_' : 'PASHU_QR_';
    const filename = `${prefix}${animalCode || activeValueToCopy}.svg`;

    const blob = new Blob([activeSvgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPng = () => {
    const isBarcode = activeFormat === 'BARCODE';
    const prefix = isBarcode ? 'PASHU_BARCODE_' : 'PASHU_QR_';
    const filename = `${prefix}${animalCode || activeValueToCopy}.png`;

    if (!isBarcode && effectiveQrToken) {
      const dataUrl = generateQrDataUrl(effectiveQrToken, 400);
      if (dataUrl) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
    }

    // Canvas fallback for SVG to PNG rasterization
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const svgBlob = new Blob([activeSvgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = img.width * 2 || 600;
      canvas.height = img.height * 2 || 300;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const showFormatToggle = tagType === 'BOTH' || (Boolean(token) && Boolean(barcodeValue || tagNumber));

  return (
    <div className="bg-white rounded-2xl border-2 border-[#135D43]/20 p-4 shadow-sm space-y-4">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#135D43] flex items-center justify-center font-bold">
            {activeFormat === 'BARCODE' ? <BarcodeIcon className="w-5 h-5" /> : <QrCode className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#1E293B]">
              {activeFormat === 'BARCODE'
                ? 'સત્તાવાર ૧D બારકોડ ટેગ (Official 1D Barcode)'
                : 'સત્તાવાર પશુ QR કોડ (Official Animal QR)'}
            </h4>
            <p className="text-[10px] text-[#64748B]">
              {activeFormat === 'BARCODE'
                ? 'Code 128 સ્ટાન્ડર્ડ — ૧D કેમેરા સ્કેનર અથવા હેન્ડહેલ્ડ લેસર વડે સ્કેન કરો'
                : 'કેમેરા સ્કેનર અથવા પશુરક્ષક સ્કેન મોડ વડે સ્કેન કરો'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Format Switcher if both available or requested */}
          {showFormatToggle && (
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setActiveFormat('QR')}
                className={`px-2.5 py-1 rounded-md font-semibold text-[11px] flex items-center gap-1 transition ${
                  activeFormat === 'QR'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                QR કોડ
              </button>
              <button
                type="button"
                onClick={() => setActiveFormat('BARCODE')}
                className={`px-2.5 py-1 rounded-md font-semibold text-[11px] flex items-center gap-1 transition ${
                  activeFormat === 'BARCODE'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarcodeIcon className="w-3.5 h-3.5" />
                ૧D Barcode
              </button>
            </div>
          )}

          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3 h-3" />
            સક્રિય
          </span>
        </div>
      </div>

      {/* Visual Tag Display (Square for QR, Horizontal Rectangle with vertical lines for Barcode) */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
        {activeFormat === 'BARCODE' ? (
          <div className="w-full sm:w-64 max-w-sm bg-white p-2.5 rounded-xl shadow-xs border border-gray-200 flex items-center justify-center overflow-x-auto">
            <div
              className="w-full flex justify-center"
              dangerouslySetInnerHTML={{ __html: barcodeSvgString }}
            />
          </div>
        ) : (
          <div
            className="w-44 h-44 bg-white p-2 rounded-xl shadow-xs border border-gray-200 flex items-center justify-center shrink-0"
            dangerouslySetInnerHTML={{ __html: qrSvgString }}
          />
        )}

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

          {/* Active Identifier Box */}
          <div className="pt-1">
            <span className="text-[#64748B] text-[10px]">
              {activeFormat === 'BARCODE' ? '૧D બારકોડ ઓળખ ક્રમાંક:' : 'સક્રિય Base32 QR ટોકન:'}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <code className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md flex-1 break-all select-all">
                {activeValueToCopy}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 text-xs text-[#64748B] hover:text-[#1E293B] bg-white border border-[#CBD5E1] rounded-md transition-colors"
                title="કોપી કરો"
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
            {activeFormat === 'BARCODE' ? 'પ્રિન્ટ ૧D બારકોડ પાસ' : 'પ્રિન્ટ QR પાસ'}
          </Button>
        </div>
      )}
    </div>
  );
};
