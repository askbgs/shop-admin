'use client';

import { useFormStatus } from 'react-dom';
import BusyModal from './BusyModal';

/**
 * Drop inside any <form action={serverAction}>. While that form is submitting it shows the
 * loading modal; it closes when the save (and the redirect after it) has finished.
 *
 * - title / detail: what is happening ("Saving product…").
 * - photoTitle / photoDetail: used instead when the form carries a picked photo (field "photo").
 * - field + titles: pick the title from a submitted value, e.g. which status button was pressed.
 */
export default function PendingModal({
  title,
  detail,
  photoTitle,
  photoDetail,
  field,
  titles,
}: {
  title: string;
  detail?: string;
  photoTitle?: string;
  photoDetail?: string;
  field?: string;
  titles?: Record<string, string>;
}) {
  const { pending, data } = useFormStatus();
  const photo = data?.get('photo');
  const hasPhoto = typeof File !== 'undefined' && photo instanceof File && photo.size > 0;
  const keyed = field && titles ? titles[String(data?.get(field) ?? '')] : undefined;

  return (
    <BusyModal
      open={pending}
      title={hasPhoto && photoTitle ? photoTitle : keyed ?? title}
      detail={hasPhoto && photoDetail ? photoDetail : detail}
    />
  );
}
