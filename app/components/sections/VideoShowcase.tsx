import type { VideoItem } from '@/app/types';
import { YOUTUBE_EMBED_BASE_URL } from '@/app/lib/constants';

interface VideoShowcaseProps {
  videos: VideoItem[];
  description: string;
}

export default function VideoShowcase({
  videos,
  description,
}: VideoShowcaseProps) {
  return (
    <section className="bg-[#0d1321] text-white py-20 md:py-28 border-t border-slate-900/40">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 max-w-6xl mx-auto">
          {videos.map((video, index) => (
            <div 
              key={video.id || index} 
              className="relative aspect-video rounded-2xl overflow-hidden border border-slate-800/80 hover:border-ez-pink/40 hover:scale-[1.01] shadow-2xl shadow-black/45 hover:shadow-ez-pink/5 transition-all duration-300 bg-slate-950/40"
            >
              <iframe
                src={`${YOUTUBE_EMBED_BASE_URL}/${video.videoId}`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          ))}
        </div>
        <div className="text-center max-w-4xl mx-auto px-4">
          <div className="inline-block w-8 h-1 bg-gradient-to-r from-ez-pink to-ez-purple rounded-full mb-6" />
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-medium">{description}</p>
        </div>
      </div>
    </section>
  );
}

