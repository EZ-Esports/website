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
    <section className="bg-background-secondary text-foreground py-16 md:py-24 border-t border-custom-border/30">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 max-w-6xl mx-auto">
          {videos.map((video, index) => (
            <div 
              key={video.id || index} 
              className="relative aspect-video rounded-xl overflow-hidden border border-custom-border/80 bg-background/40"
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
          <p className="text-base sm:text-lg text-foreground-secondary leading-relaxed font-medium">{description}</p>
        </div>
      </div>
    </section>
  );
}

