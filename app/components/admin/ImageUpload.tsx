'use client';

import { useState, useRef } from 'react';

interface ImageUploadProps {
  name: string;
  storageKeyName: string;
  currentSrc?: string;
  currentStorageKey?: string;
  label?: string;
  required?: boolean;
}

export default function ImageUpload({
  name,
  storageKeyName,
  currentSrc,
  currentStorageKey,
  label = 'Image',
  required = false,
}: ImageUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string>(currentSrc ?? '');
  const [storageKey, setStorageKey] = useState<string>(currentStorageKey ?? '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: fd,
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? 'Upload failed');
        return;
      }

      setPreviewUrl(json.url);
      setStorageKey(json.storageKey);
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="block text-sm text-zinc-400 mb-1">
        {label}
        {required && <span className="text-ez-pink ml-1">*</span>}
      </label>

      {/* Hidden inputs that submit to parent form */}
      <input
        type="hidden"
        name={name}
        value={previewUrl}
        required={required}
      />
      <input
        type="hidden"
        name={storageKeyName}
        value={storageKey}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="bg-ez-pink text-black px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-ez-pink/90 transition-all disabled:opacity-50 cursor-pointer"
        >
          {uploading ? 'Uploading…' : 'Choose File'}
        </button>
        {uploading && (
          <span className="text-zinc-400 text-sm">Uploading…</span>
        )}
        {!uploading && !previewUrl && (
          <span className="text-zinc-600 text-sm">No file chosen</span>
        )}
      </div>

      {/* Hidden real file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
        onChange={handleFileChange}
        className="hidden"
      />

      {error && (
        <p className="text-red-400 text-sm mt-1">{error}</p>
      )}

      {previewUrl && !uploading && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Preview"
          className="max-h-40 rounded-lg object-contain mt-2"
        />
      )}
    </div>
  );
}
