import { HiOutlinePhoto } from 'react-icons/hi2';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { asc, isNull } from 'drizzle-orm';
import { addGalleryImage } from './actions';
import GalleryManagerClient from '@/app/components/admin/GalleryManagerClient';
import ImageUpload from '@/app/components/admin/ImageUpload';
import SubmitButton from '@/app/components/admin/SubmitButton';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import AddEntityForm from '@/app/components/admin/AddEntityForm';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import { getStaffForAdminSection } from '@/app/lib/auth';
import { AdminCount, AdminEmptyState, AdminPage, AdminPageHeader, AdminSection, RequiredMark } from '@/app/components/admin/AdminUI';
import { input, label as labelClass } from '@/app/components/admin/styles';

async function getAllGalleryImages() {
  return db
    .select()
    .from(schema.galleryImages)
    .where(isNull(schema.galleryImages.deletedAt))
    .orderBy(asc(schema.galleryImages.displayOrder), asc(schema.galleryImages.createdAt));
}

export default async function GalleryAdminPage() {
  if (!(await getStaffForAdminSection('/admin/gallery'))) return <PermissionDenied />;

  let images: Awaited<ReturnType<typeof getAllGalleryImages>> = [];
  let dbConfigured = false;

  try {
    if (process.env.DATABASE_URL) {
      images = await getAllGalleryImages();
      dbConfigured = true;
    }
  } catch {
    // db not reachable
  }

  const set1 = images;

  return (
    <AdminPage>
      <AdminPageHeader
        route="/admin/gallery"
        description="Photos for the homepage gallery. Reorder with the arrows on each card, then save the new order."
      />

      {!dbConfigured && <DbErrorNotice />}

      {/* Add Image Form */}
      <AdminSection id="add-image" title="Add a gallery image">
        <AddEntityForm action={addGalleryImage} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <ImageUpload section="gallery" name="src" storageKeyName="storageKey" label="Image" required />
          </div>
          <div className="sm:col-span-2">
            {/* Caption is required — it also serves as the image alt text (WCAG) */}
            <label htmlFor="add-image-caption" className={labelClass}>
              Caption / alt text <RequiredMark />
            </label>
            <input
              id="add-image-caption"
              name="caption"
              type="text"
              required
              placeholder="Spring 2022 Championship (used as image alt text)"
              className={input}
            />
          </div>
          <div>
            <label htmlFor="add-image-schoolName" className={labelClass}>School name</label>
            <input
              id="add-image-schoolName"
              name="schoolName"
              type="text"
              placeholder="Stuyvesant High School"
              className={input}
            />
          </div>
          <div>
            <label htmlFor="add-image-eventName" className={labelClass}>Event name</label>
            <input
              id="add-image-eventName"
              name="eventName"
              type="text"
              placeholder="Spring 2022 Finals"
              className={input}
            />
          </div>

          <div className="sm:col-span-2 flex justify-end border-t border-line/60 pt-4">
            <SubmitButton label="Add image" pendingLabel="Adding…" />
          </div>
        </AddEntityForm>
      </AdminSection>

      {/* Gallery Images */}
      <AdminSection variant="bare" title={<>Gallery images<AdminCount>{set1.length}</AdminCount></>}>
        {set1.length === 0 ? (
          <div className="rounded-2xl bg-admin-panel">
            <AdminEmptyState compact icon={<HiOutlinePhoto />} title="No images in the gallery yet." description="Add the first one above." />
          </div>
        ) : (
          <GalleryManagerClient initialImages={set1} />
        )}
      </AdminSection>
    </AdminPage>
  );
}
