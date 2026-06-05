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
    <section className="bg-[#0d1321] text-white py-16 md:py-24 border-t border-slate-900/40">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 max-w-6xl mx-auto">
          {videos.map((video, index) => (
            <div 
              key={video.id || index} 
              className="relative aspect-video rounded-xl overflow-hidden border border-slate-900 bg-slate-950/40"
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
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-medium">{description}</p>
        </div>
      </div>
    </section>
  );
}

