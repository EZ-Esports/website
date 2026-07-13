'use client';

import { useState, useRef, useEffect } from 'react';

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
  const rootRef = useRef<HTMLDivElement>(null);

  // Native form.reset() (used by AddEntityForm on a successful add) clears DOM
  // fields but not React state — sync our preview/storageKey back to defaults so
  // the next entry doesn't silently reuse the previous upload.
  useEffect(() => {
    const form = rootRef.current?.closest('form');
    if (!form) return;
    const onReset = () => {
      setPreviewUrl(currentSrc ?? '');
      setStorageKey(currentStorageKey ?? '');
      setError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  }, [currentSrc, currentStorageKey]);

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation before hitting the server
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError('File too large. Maximum size is 5 MB.');
      e.target.value = '';
      return;
    }

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
    <div ref={rootRef}>
      <label className="block text-sm text-foreground-secondary mb-1">
        {label}
        {required && <span className="text-accent ml-1">*</span>}
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
          className="bg-accent text-black px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-accent/90 transition-all disabled:opacity-50 cursor-pointer"
        >
          {uploading ? 'Uploading…' : 'Choose File'}
        </button>
        {uploading && (
          <span className="text-foreground-secondary text-sm">Uploading…</span>
        )}
        {!uploading && !previewUrl && (
          <span className="text-foreground-muted text-sm">No file chosen</span>
        )}
      </div>

      {/* Hidden real file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
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
