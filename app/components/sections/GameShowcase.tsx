import Image from 'next/image';

interface GameShowcaseProps {
  title: string;
  games: Array<{ title: string; imageUrl: string }>;
}

export default function GameShowcase({ title, games }: GameShowcaseProps) {
  return (
    <section className="bg-gray-900 text-white py-16 md:py-24">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl md:text-5xl font-bold mb-12 text-center">{title}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {games.map((game, index) => (
            <div
              key={index}
              className="aspect-video relative rounded-lg overflow-hidden group cursor-pointer"
              role="img"
              aria-label={`${game.title} game`}
            >
              <Image
                src={game.imageUrl}
                alt={game.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" aria-hidden="true" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="text-white text-lg font-semibold">{game.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

