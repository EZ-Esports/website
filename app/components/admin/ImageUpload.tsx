'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { HiArrowUpTray, HiPhoto, HiXMark, HiArrowPath } from 'react-icons/hi2';
import {
  MAX_FILE_SIZE_BYTES,
  MAX_RAW_INPUT_BYTES,
  MAX_IMAGE_DIMENSION,
  ALLOWED_MIME_TYPES,
  type UploadSection,
} from '@/app/lib/storage-constants';
import { compressImage } from '@/app/lib/image-compression';
import { chip, chipDot, fieldError, focusRing, labelText, secondaryBtnSm } from '@/app/components/admin/styles';
import { RequiredMark } from '@/app/components/admin/AdminUI';
import { cx } from '@/app/lib/cx';

interface ImageUploadProps {
  name: string;
  storageKeyName: string;
  section: UploadSection;
  entityId?: string;
  entityIdName?: string;
  currentSrc?: string;
  currentStorageKey?: string;
  label?: string;
  required?: boolean;
}

const ALLOWED_TYPES = ALLOWED_MIME_TYPES as readonly string[];

export default function ImageUpload({
  name,
  storageKeyName,
  section,
  entityId,
  entityIdName,
  currentSrc,
  currentStorageKey,
  label = 'Image',
  required = false,
}: ImageUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string>(currentSrc ?? '');
  const [storageKey, setStorageKey] = useState<string>(currentStorageKey ?? '');
  const [draftId, setDraftId] = useState<string>(() => crypto.randomUUID());
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);

  const effectiveEntityId = entityId || draftId;

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
      setDraftId(crypto.randomUUID());
    };
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  }, [currentSrc, currentStorageKey]);

  const processFile = useCallback(async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.');
      return;
    }
    if (file.size > MAX_RAW_INPUT_BYTES) {
      setError('File too large. Maximum raw file size is 20 MB.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Client-side compression to prevent multi-megabyte raw photos from entering storage
      const fileToUpload = await compressImage(file, {
        maxDimension: MAX_IMAGE_DIMENSION,
        quality: 0.85,
      });

      if (fileToUpload.size > MAX_FILE_SIZE_BYTES) {
        setError('File exceeds maximum upload limit of 5 MB even after compression.');
        setUploading(false);
        return;
      }

      const fd = new FormData();
      fd.append('file', fileToUpload);
      fd.append('section', section);
      fd.append('entityId', effectiveEntityId);

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
  }, [section, effectiveEntityId]);

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
        <span className={labelText}>
          {label}
          {required && <RequiredMark />}
        </span>
      )}

      {/* Hidden form submission inputs */}
      <input type="hidden" name={name} value={previewUrl} required={required} />
      <input type="hidden" name={storageKeyName} value={storageKey} />
      <input type="hidden" name={entityIdName ?? 'entityId'} value={effectiveEntityId} />

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
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          onKeyDown={handleKeyDown}
          className={cx(
            'relative w-full rounded-xl border border-dashed p-4 text-center cursor-pointer select-none transition-[background-color,border-color,scale] duration-200 ease-out',
            focusRing,
            isDragOver
              ? 'border-accent bg-accent/10 scale-[1.01] motion-reduce:scale-100'
              : 'border-line bg-surface-sunken hover:bg-surface-raised/60 hover:border-foreground-muted',
            uploading && 'pointer-events-none opacity-80',
          )}
        >
          {uploading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-3">
              <HiArrowPath aria-hidden className="w-6 h-6 text-accent animate-spin" />
              <span className="text-sm font-medium text-foreground">
                Uploading image…
              </span>
              <span className="text-xs text-foreground-secondary">
                Optimizing and storing asset
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-2">
              <div
                className={cx(
                  'w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200',
                  isDragOver ? 'bg-accent text-on-accent' : 'bg-surface-raised text-foreground-secondary',
                )}
              >
                {isDragOver ? (
                  <HiArrowUpTray aria-hidden className="w-5 h-5 -translate-y-0.5 transition-transform" />
                ) : (
                  <HiPhoto aria-hidden className="w-5 h-5" />
                )}
              </div>
              <div className="space-y-0.5">
                <p className="text-sm text-foreground">
                  <span className="font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">
                    Click to browse
                  </span>{' '}
                  or drag & drop
                </p>
                <p className="text-xs text-foreground-secondary">
                  JPEG, PNG, GIF, or WebP (max 5 MB)
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Image Preview with Unclipped Responsive Stack */
        <div className="admin-fade-in relative w-full space-y-2.5 rounded-xl bg-surface-sunken p-3">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-11 h-11 rounded-lg bg-surface-raised flex-shrink-0 flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Uploaded preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate max-w-[120px] sm:max-w-[180px]">
                  {storageKey ? storageKey.split('/').pop() : 'Image loaded'}
                </div>
                <span className={cx(chip('success', 'sm'), 'mt-1')}>
                  <span aria-hidden className={chipDot} />
                  Ready
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              aria-label="Remove image"
              className={cx('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-foreground-secondary hover:text-red-300 hover:bg-red-950/40 transition-colors duration-150 cursor-pointer', focusRing)}
            >
              <HiXMark aria-hidden className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Replace image"
            className={cx(secondaryBtnSm, 'w-full')}
          >
            <HiArrowUpTray aria-hidden className="w-3.5 h-3.5" />
            Replace image
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div role="alert" aria-live="polite" className={fieldError}>
          {error}
        </div>
      )}
    </div>
  );
}
