import Card from '@/app/components/ui/Card';

export default function ArchivesPage() {
  return (
    <main className="container mx-auto px-4 py-20 min-h-[60vh] flex flex-col justify-center">
      <div className="mb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight uppercase">Archives</h1>
        <div className="w-12 h-0.5 bg-slate-700 mx-auto rounded-full mb-4" />
        <p className="text-slate-400 font-medium">
          Explore past matches, standings, and seasonal records
        </p>
      </div>
      
      <Card className="max-w-2xl mx-auto text-center py-12 hover:scale-[1.01] duration-300">
        <div className="w-16 h-16 bg-slate-900 border border-slate-850 rounded-full flex items-center justify-center mx-auto mb-6 text-white">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <p className="text-slate-300 text-base sm:text-lg font-medium">
          Seasonal archives are currently being processed. Check back soon!
        </p>
      </Card>
    </main>
  );
}
