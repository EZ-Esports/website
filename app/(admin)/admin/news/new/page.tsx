import Link from 'next/link';
import { createNewsPost } from '../actions';
import Card from '@/app/components/ui/Card';
import NewsPostForm from '@/app/components/admin/NewsPostForm';

export default function AdminNewNewsPostPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center">
        <Link href="/admin/news" className="text-xs font-bold text-slate-400 hover:text-ez-pink uppercase tracking-widest transition-colors">
          ← Back to News list
        </Link>
      </div>

      <Card className="p-8 space-y-6 hover:shadow-none hover:border-slate-800/80 duration-300">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wider">Write Announcement</h1>
          <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">Publish news updates to the public league portal.</p>
        </div>

        <NewsPostForm action={createNewsPost} status="new" />
      </Card>
    </div>
  );
}
