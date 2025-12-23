import Link from 'next/link';

interface VideoShowcaseProps {
  videos: Array<{ videoId: string; title: string }>;
  description: string;
  reportLink: string;
  sizzleLink: string;
}

export default function VideoShowcase({
  videos,
  description,
  reportLink,
  sizzleLink,
}: VideoShowcaseProps) {
  return (
    <section className="bg-gray-900 text-white py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {videos.map((video, index) => (
            <div key={index} className="relative aspect-video rounded-lg overflow-hidden">
              <iframe
                src={`https://www.youtube.com/embed/${video.videoId}`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          ))}
        </div>
        <div className="text-center mb-8">
          <p className="text-lg leading-relaxed max-w-4xl mx-auto">{description}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href={reportLink}
            className="px-6 py-3 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors text-center focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-gray-900"
          >
            Read the 2022-2023 Impact Report
          </Link>
          <Link
            href={sizzleLink}
            className="px-6 py-3 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors text-center focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-gray-900"
          >
            Watch the Sizzle
          </Link>
        </div>
      </div>
    </section>
  );
}

