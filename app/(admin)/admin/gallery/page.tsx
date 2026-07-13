import Card from '@/app/components/ui/Card';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { isNull } from 'drizzle-orm';
import { addGalleryImage } from './actions';
import GalleryImageCard from '@/app/components/admin/GalleryImageCard';
import ImageUpload from '@/app/components/admin/ImageUpload';
import SubmitButton from '@/app/components/admin/SubmitButton';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import AddEntityForm from '@/app/components/admin/AddEntityForm';

async function getAllGalleryImages() {
  return db.select().from(schema.galleryImages).where(isNull(schema.galleryImages.deletedAt)).orderBy(schema.galleryImages.setId, schema.galleryImages.displayOrder);
}

export default async function GalleryAdminPage() {
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

  const set1 = images.filter((img) => img.setId === 1);
  const set2 = images.filter((img) => img.setId === 2);

  return (
    <div className="space-y-8">
      {/* Add Image Form */}
      <Card className="bg-surface-raised/30 border border-line border-l-4 border-l-accent">
        <h2 className="text-lg font-black text-white uppercase tracking-wider mb-5">Add Gallery Image</h2>
        <AddEntityForm action={addGalleryImage} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <ImageUpload name="src" storageKeyName="storageKey" label="Image" required />
          </div>
          <div>
            {/* Caption is required — it also serves as the image alt text (WCAG) */}
            <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
              Caption / Alt Text <span className="text-accent">*</span>
            </label>
            <input
              name="caption"
              type="text"
              required
              placeholder="Spring 2022 Championship (used as image alt text)"
              className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-line text-white placeholder-foreground-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">School Name</label>
            <input
              name="schoolName"
              type="text"
              placeholder="Stuyvesant High School"
              className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-line text-white placeholder-foreground-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">Event Name</label>
            <input
              name="eventName"
              type="text"
              placeholder="Spring 2022 Finals"
              className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-line text-white placeholder-foreground-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">Gallery Set</label>
            <select
              name="setId"
              defaultValue="1"
              className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-line text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 transition-all"
            >
              <option value="1">Set 1 (Primary)</option>
              <option value="2">Set 2 (Secondary)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">Display Order</label>
            <input
              name="displayOrder"
              type="number"
              defaultValue="0"
              className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-line text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 transition-all"
            />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton
              label="Add Image"
              pendingLabel="Adding…"
              className="px-6 py-2.5 bg-accent text-on-accent rounded-lg font-bold text-sm hover:bg-accent/80 transition-all duration-300 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
        </AddEntityForm>
      </Card>

      {!dbConfigured && <DbErrorNotice />}

      {/* Gallery Set 1 */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-white uppercase tracking-wider">Gallery Set 1</h2>
        {set1.length === 0 ? (
          <p className="text-foreground-muted text-sm">No images in Set 1 yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {set1.map((img) => (
              <GalleryImageCard key={img.id} img={img} />
            ))}
          </div>
        )}
      </div>

      {/* Gallery Set 2 */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-white uppercase tracking-wider">Gallery Set 2</h2>
        {set2.length === 0 ? (
          <p className="text-foreground-muted text-sm">No images in Set 2 yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {set2.map((img) => (
              <GalleryImageCard key={img.id} img={img} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
