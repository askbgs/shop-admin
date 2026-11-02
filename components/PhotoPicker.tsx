'use client';

import { useEffect, useRef, useState } from 'react';
import { shrinkImage } from '@/lib/shrink-image';

// Photo field for the "New product" form. The picked photo is resized to JPEG in the browser
// and placed into a hidden file input, so it is sent with the form and uploaded to PinPicX
// when the product is created.
export default function PhotoPicker() {
  const picker = useRef<HTMLInputElement>(null);
  const carrier = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number; kb: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const clear = () => {
    if (carrier.current) carrier.current.value = '';
    setPreview(null);
    setSize(null);
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const { blob, width, height } = await shrinkImage(file);
      const jpg = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
      const dt = new DataTransfer();
      dt.items.add(jpg);
      if (carrier.current) carrier.current.files = dt.files;
      setPreview(URL.createObjectURL(blob));
      setSize({ w: width, h: height, kb: Math.round(blob.size / 1024) });
    } catch (err) {
      clear();
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="photo-picker">
      <input ref={carrier} type="file" name="photo" hidden tabIndex={-1} aria-hidden="true" data-testid="photo-carrier" />
      <input type="hidden" name="photo_width" value={size?.w ?? ''} />
      <input type="hidden" name="photo_height" value={size?.h ?? ''} />
      <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/*" hidden onChange={onPick} data-testid="photo-input" />

      <button type="button" className="img-up-box pp-box" onClick={() => picker.current?.click()} disabled={busy} aria-label="Choose product photo">
        {preview ? <img src={preview} alt="Selected product photo" /> : (
          <span className="pp-empty">
            <span className="img-up-plus">＋</span>
            <span>Add product photo</span>
          </span>
        )}
        {busy && <span className="img-up-busy">Preparing…</span>}
      </button>

      <div className="pp-side">
        <div className="img-up-actions">
          <button type="button" className="btn" onClick={() => picker.current?.click()} disabled={busy}>
            {preview ? 'Choose another photo' : 'Choose photo'}
          </button>
          {preview && <button type="button" className="btn danger" onClick={clear} disabled={busy}>Remove</button>}
        </div>
        <small className="muted">
          {size
            ? `Ready: ${size.w}×${size.h} JPEG, ${size.kb} KB — uploaded to PinPicX when you create the product.`
            : 'JPG or PNG from your phone or computer. It’s resized automatically and uploaded to PinPicX. You can add photos for each colour after creating the product.'}
        </small>
        {error && <div className="img-up-err">{error}</div>}
      </div>
    </div>
  );
}
