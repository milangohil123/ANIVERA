import React, { useRef } from 'react';
import { Camera, Image as ImageIcon, Trash2, CheckCircle2 } from 'lucide-react';

export interface SelectedPhoto {
  file: File;
  previewUrl: string;
  sizeBytes: number;
}

interface CameraCaptureProps {
  photo: SelectedPhoto | null;
  onPhotoSelected: (photo: SelectedPhoto) => void;
  onPhotoRemoved: () => void;
  disabled?: boolean;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  photo,
  onPhotoSelected,
  onPhotoRemoved,
  disabled = false,
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate mime type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('કૃપા કરીને માત્ર JPEG, PNG અથવા WebP ફોટો પસંદ કરો.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    onPhotoSelected({
      file,
      previewUrl,
      sizeBytes: file.size,
    });

    // Reset input so re-selecting same file triggers onChange
    e.target.value = '';
  };

  const handleRemove = () => {
    if (photo?.previewUrl) {
      URL.revokeObjectURL(photo.previewUrl);
    }
    onPhotoRemoved();
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-gray-700">
        રોગના લક્ષણનો ફોટોગ્રાફ (ચકાસણી પુરાવો)
      </label>

      {/* Hidden file inputs for Camera and Gallery */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />

      {!photo ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={disabled}
            className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-emerald-400 rounded-xl bg-emerald-50/50 hover:bg-emerald-100/50 transition-colors text-emerald-800 disabled:opacity-50"
          >
            <Camera className="w-8 h-8 mb-1 text-emerald-600" />
            <span className="text-sm font-medium">કેમેરા ખોલો</span>
            <span className="text-xs text-gray-500">(સીધો ફોટો પાડો)</span>
          </button>

          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={disabled}
            className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-gray-700 disabled:opacity-50"
          >
            <ImageIcon className="w-8 h-8 mb-1 text-gray-500" />
            <span className="text-sm font-medium">ગેલેરી / ફાઇલ</span>
            <span className="text-xs text-gray-500">(મોબાઇલ સ્ટોરેજમાંથી)</span>
          </button>
        </div>
      ) : (
        <div className="relative border border-emerald-300 rounded-xl p-3 bg-emerald-50/30">
          <div className="flex items-start gap-3">
            <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200 bg-black/5 flex-shrink-0">
              <img
                src={photo.previewUrl}
                alt="Selected symptom"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex-1 min-w-0 py-1">
              <div className="flex items-center gap-1.5 text-emerald-700 text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="truncate">{photo.file.name}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                કદ: {(photo.sizeBytes / 1024).toFixed(1)} KB ({photo.file.type || 'image/jpeg'})
              </p>
              <p className="text-xs text-emerald-600 mt-1">
                સબમિશન પર સ્વચાલિત કોમ્પ્રેસ થશે (મહત્તમ 1920px).
              </p>
            </div>

            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200 hover:border-red-300"
              title="ફોટો કાઢી નાખો"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

