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
    <section className="bg-gray-900 text-white py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {videos.map((video, index) => (
            <div key={video.id || index} className="relative aspect-video rounded-lg overflow-hidden">
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
        <div className="text-center">
          <p className="text-lg leading-relaxed max-w-4xl mx-auto">{description}</p>
        </div>
      </div>
    </section>
  );
}

