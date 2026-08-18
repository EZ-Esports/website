'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { HiArrowUpTray, HiPhoto, HiXMark, HiArrowPath } from 'react-icons/hi2';

interface ImageUploadProps {
  name: string;
  storageKeyName: string;
  currentSrc?: string;
  currentStorageKey?: string;
  label?: string;
  required?: boolean;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

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
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);

  // Sync state back to initial values when parent form is reset
  useEffect(() => {
    const form = rootRef.current?.closest('form');
    if (!form) return;
    const onReset = () => {
      setPreviewUrl(currentSrc ?? '');
      setStorageKey(currentStorageKey ?? '');
      setError(null);
      setIsDragOver(false);
      dragCounterRef.current = 0;
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  }, [currentSrc, currentStorageKey]);

  const processFile = useCallback(async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError('File too large. Maximum size is 5 MB.');
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
      setError('Upload failed. Please check your connection and try again.');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    // Clear input value so same file can be re-uploaded if modified
    e.target.value = '';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDragOver(false);
      dragCounterRef.current = 0;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounterRef.current = 0;

    if (uploading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleRemove = () => {
    setPreviewUrl('');
    setStorageKey('');
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!uploading) {
        fileInputRef.current?.click();
      }
    }
  };

  return (
    <div ref={rootRef} className="space-y-1.5 w-full">
      {label && (
        <span className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider">
          {label}
          {required && <span className="text-accent ml-1">*</span>}
        </span>
      )}

      {/* Hidden form submission inputs */}
      <input type="hidden" name={name} value={previewUrl} required={required} />
      <input type="hidden" name={storageKeyName} value={storageKey} />

      {/* Hidden real file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Dropzone & Preview Container */}
      {!previewUrl || uploading ? (
        <div
          role="button"
          tabIndex={uploading ? -1 : 0}
          aria-label={`Upload ${label}. Drag and drop an image or press Enter to browse files`}
          aria-busy={uploading}
          aria-invalid={!!error}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          onKeyDown={handleKeyDown}
          className={`relative w-full rounded-xl border-2 border-dashed p-4 text-center transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent/40 ${
            isDragOver
              ? 'border-accent bg-accent/15 scale-[1.01] shadow-lg shadow-accent/10'
              : 'border-line/80 bg-surface-sunken/60 hover:bg-surface-raised/60 hover:border-line'
          } ${uploading ? 'pointer-events-none opacity-80' : ''}`}
        >
          {uploading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-3">
              <HiArrowPath className="w-7 h-7 text-accent animate-spin" />
              <span className="text-xs font-bold text-foreground animate-pulse">
                Uploading image…
              </span>
              <span className="text-[11px] text-foreground-muted">
                Optimizing and storing asset
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-2">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isDragOver
                    ? 'bg-accent text-on-accent'
                    : 'bg-surface-raised border border-line text-foreground-secondary'
                }`}
              >
                {isDragOver ? (
                  <HiArrowUpTray className="w-5 h-5 animate-bounce" />
                ) : (
                  <HiPhoto className="w-5 h-5" />
                )}
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-white">
                  <span className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">
                    Click to browse
                  </span>{' '}
                  or drag & drop
                </p>
                <p className="text-[11px] text-foreground-secondary">
                  JPEG, PNG, GIF, or WebP (max 5 MB)
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Image Preview with Unclipped Responsive Stack */
        <div className="relative rounded-xl border border-line/80 bg-surface-sunken/80 p-3 space-y-2.5 w-full">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-11 h-11 rounded-lg bg-surface-raised border border-line flex-shrink-0 flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Uploaded preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate max-w-[120px] sm:max-w-[180px]">
                  {storageKey ? storageKey.split('/').pop() : 'Image loaded'}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-green-400 font-semibold uppercase mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                  <span>Ready</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              aria-label="Remove image"
              className="p-1.5 rounded-lg bg-surface-raised hover:bg-red-950/30 text-foreground-secondary hover:text-red-400 border border-line hover:border-red-900/40 transition-all cursor-pointer shrink-0"
            >
              <HiXMark className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Replace image"
            className="w-full py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg bg-surface-raised hover:bg-line text-foreground border border-line hover:border-line transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <HiArrowUpTray className="w-3.5 h-3.5 text-foreground-muted" />
            Replace Image
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div role="alert" className="text-xs text-red-400 font-medium pt-0.5">
          {error}
        </div>
      )}
    </div>
  );
}
