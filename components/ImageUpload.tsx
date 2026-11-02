'use client';

import { useRef, useState, useTransition } from 'react';
import { shrinkImage } from '@/lib/shrink-image';

type Props = {
  upload: (fd: FormData) => Promise<void>;
  remove: (fd: FormData) => Promise<void>;
  fields: Record<string, string>;
  imageUrl: string | null;
  fallbackUrl?: string | null; // e.g. the product photo shown under a variant without its own photo
  size?: 'sm' | 'lg';
  label?: string;
};

export default function ImageUpload({ upload, remove, fields, imageUrl, fallbackUrl, size = 'sm', label }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const shown = preview ?? imageUrl ?? fallbackUrl ?? null;
  const usingFallback = !preview && !imageUrl && !!fallbackUrl;

  const fd = () => {
    const f = new FormData();
    Object.entries(fields).forEach(([k, v]) => f.set(k, v));
    return f;
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const { blob, width, height } = await shrinkImage(file);
      setPreview(URL.createObjectURL(blob));
      const data = fd();
      data.set('file', new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
      data.set('width', String(width));
      data.set('height', String(height));
      start(() => upload(data));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onRemove = () => {
    setPreview(null);
    start(() => remove(fd()));
  };

  return (
    <div className={`img-up ${size}`}>
      <button
        type="button"
        className={`img-up-box ${usingFallback ? 'fallback' : ''}`}
        onClick={() => input.current?.click()}
        disabled={pending}
        title={usingFallback ? 'Using the product photo — click to upload a photo for this variant' : 'Click to upload a photo'}
        aria-label={label ?? 'Upload photo'}
      >
        {shown ? <img src={shown} alt="" /> : <span className="img-up-plus">＋</span>}
        {pending && <span className="img-up-busy">Uploading…</span>}
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/*" hidden onChange={onPick} data-testid="image-input" />
      {size === 'lg' && (
        <div className="img-up-actions">
          <button type="button" className="btn" onClick={() => input.current?.click()} disabled={pending}>
            {imageUrl ? 'Replace photo' : 'Upload photo'}
          </button>
          {imageUrl && <button type="button" className="btn danger" onClick={onRemove} disabled={pending}>Remove</button>}
        </div>
      )}
      {size === 'sm' && imageUrl && !pending && (
        <button type="button" className="img-up-x" onClick={onRemove} title="Remove this variant's photo" aria-label="Remove photo">✕</button>
      )}
      {error && <div className="img-up-err">{error}</div>}
    </div>
  );
}
