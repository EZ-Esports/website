import Image from 'next/image';
import Link from 'next/link';
import Card from '@/app/components/ui/Card';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { addGalleryImage } from './actions';

async function getAllGalleryImages() {
  return db.select().from(schema.galleryImages).orderBy(schema.galleryImages.setId, schema.galleryImages.displayOrder);
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
      <Card className="bg-slate-900/30 border border-slate-800">
        <h2 className="text-lg font-black text-white uppercase tracking-wider mb-5">Add Gallery Image</h2>
        <form action={addGalleryImage} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Image URL <span className="text-ez-pink">*</span>
            </label>
            <input
              name="src"
              type="text"
              required
              placeholder="/images/gallery/gallery-12.png"
              className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-zinc-800 text-white placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-ez-pink/40 focus:border-ez-pink/60 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Caption</label>
            <input
              name="caption"
              type="text"
              placeholder="Spring 2022 Championship"
              className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-zinc-800 text-white placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-ez-pink/40 focus:border-ez-pink/60 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">School Name</label>
            <input
              name="schoolName"
              type="text"
              placeholder="Stuyvesant High School"
              className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-zinc-800 text-white placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-ez-pink/40 focus:border-ez-pink/60 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Event Name</label>
            <input
              name="eventName"
              type="text"
              placeholder="Spring 2022 Finals"
              className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-zinc-800 text-white placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-ez-pink/40 focus:border-ez-pink/60 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Gallery Set</label>
            <select
              name="setId"
              defaultValue="1"
              className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-zinc-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-ez-pink/40 focus:border-ez-pink/60 transition-all"
            >
              <option value="1">Set 1 (Primary)</option>
              <option value="2">Set 2 (Secondary)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Display Order</label>
            <input
              name="displayOrder"
              type="number"
              defaultValue="0"
              className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-zinc-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-ez-pink/40 focus:border-ez-pink/60 transition-all"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="px-6 py-2.5 bg-ez-pink text-white rounded-lg font-bold text-sm hover:bg-ez-pink/80 transition-all duration-300 cursor-pointer"
            >
              Add Image
            </button>
          </div>
        </form>
      </Card>

      {!dbConfigured && (
        <div className="bg-amber-500/5 border border-amber-500/25 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <span className="text-3xl mt-0.5 select-none animate-pulse">⚠️</span>
            <div>
              <h3 className="text-lg font-bold text-amber-400 tracking-tight">Database Not Configured</h3>
              <p className="text-slate-300 text-sm leading-relaxed mt-1">
                Set <code>DATABASE_URL</code> in your <code>.env</code> file and run <code>npm run db:push</code> to enable gallery management.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Gallery Set 1 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-white uppercase tracking-wider">Gallery Set 1</h2>
          <Link href="#" className="text-xs font-bold text-slate-400 hover:text-white uppercase tracking-wider transition-colors">
            + Add Image
          </Link>
        </div>
        {set1.length === 0 ? (
          <p className="text-slate-500 text-sm">No images in Set 1 yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {set1.map((img) => (
              <div key={img.id} className="bg-[#1a1a1a] border border-zinc-800 rounded-xl overflow-hidden group hover:border-zinc-700 transition-all duration-300">
                <div className="relative w-full aspect-square bg-zinc-900">
                  <Image
                    src={img.src}
                    alt={img.caption ?? ''}
                    width={200}
                    height={200}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
                <div className="p-3 space-y-1.5">
                  <p className="text-white text-xs font-semibold leading-tight truncate">
                    {img.caption || <span className="text-zinc-500 italic">No caption</span>}
                  </p>
                  {img.schoolName && (
                    <p className="text-zinc-400 text-xs truncate">{img.schoolName}</p>
                  )}
                  {img.eventName && (
                    <p className="text-zinc-500 text-xs truncate">{img.eventName}</p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${img.isActive ? 'bg-green-500/10 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
                      {img.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <Link href="#" className="text-xs text-slate-400 hover:text-white transition-colors font-bold">
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gallery Set 2 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-white uppercase tracking-wider">Gallery Set 2</h2>
          <Link href="#" className="text-xs font-bold text-slate-400 hover:text-white uppercase tracking-wider transition-colors">
            + Add Image
          </Link>
        </div>
        {set2.length === 0 ? (
          <p className="text-slate-500 text-sm">No images in Set 2 yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {set2.map((img) => (
              <div key={img.id} className="bg-[#1a1a1a] border border-zinc-800 rounded-xl overflow-hidden group hover:border-zinc-700 transition-all duration-300">
                <div className="relative w-full aspect-square bg-zinc-900">
                  <Image
                    src={img.src}
                    alt={img.caption ?? ''}
                    width={200}
                    height={200}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
                <div className="p-3 space-y-1.5">
                  <p className="text-white text-xs font-semibold leading-tight truncate">
                    {img.caption || <span className="text-zinc-500 italic">No caption</span>}
                  </p>
                  {img.schoolName && (
                    <p className="text-zinc-400 text-xs truncate">{img.schoolName}</p>
                  )}
                  {img.eventName && (
                    <p className="text-zinc-500 text-xs truncate">{img.eventName}</p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${img.isActive ? 'bg-green-500/10 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
                      {img.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <Link href="#" className="text-xs text-slate-400 hover:text-white transition-colors font-bold">
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
