import Image from 'next/image';

interface HeroProps {
  title: string;
  backgroundImage: string;
}

export default function Hero({ title, backgroundImage }: HeroProps) {
  return (
    <section className="h-screen relative">
      <Image
        src={backgroundImage}
        alt="Hero background"
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative h-full flex items-center justify-center">
        <h1 className="text-white text-4xl md:text-6xl font-bold text-center border-4 border-white py-8 px-12">
          {title}
        </h1>
      </div>
    </section>
  );
}

