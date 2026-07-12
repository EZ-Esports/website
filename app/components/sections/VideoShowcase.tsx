import type { VideoItem } from '@/app/types';
import { YOUTUBE_EMBED_BASE_URL } from '@/app/lib/constants';
import Section from '@/app/components/ui/Section';
import { SectionHeader } from '@/app/components/ui/SectionHeader';

interface VideoShowcaseProps {
  videos: VideoItem[];
  description: string;
}

export default function VideoShowcase({
  videos,
  description,
}: VideoShowcaseProps) {
  return (
    <Section tone="raised">
      {/* Heading says "Archives" (not "Latest") because these video IDs are historical broadcasts, not tied to the current season. */}
      <SectionHeader eyebrow="Watch" title="From the Archives" className="mb-10" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        {videos.map((video, index) => (
          <div
            key={video.id || index}
            className="relative aspect-video rounded-xl overflow-hidden border border-accent/20 bg-surface/40"
          >
            <iframe
              src={`${YOUTUBE_EMBED_BASE_URL}/${video.videoId}`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              className="w-full h-full"
            />
          </div>
        ))}
      </div>
      <div className="text-center max-w-4xl mx-auto">
        <p className="text-base sm:text-lg text-foreground-secondary leading-relaxed font-medium">{description}</p>
      </div>
    </Section>
  );
}

