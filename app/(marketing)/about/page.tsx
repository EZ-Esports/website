import ContentSection from '@/app/components/sections/ContentSection';
import Hero from '@/app/components/sections/Hero';

export default function AboutPage() {
  return (
    <main>
      <Hero
        title="About EZ Esports"
        backgroundImage="/images/hero-background.png"
      />

      <ContentSection
        heading="OUR MISSION"
        description=""
        theme="dark"
      >
        <div className="max-w-4xl mx-auto space-y-6 text-lg leading-relaxed text-center">
          <p>
            EZ Esports was founded in November 2021 and developed by various NYC high school student club officers to provide their club members opportunity to compete in an accessible and organized esports league.
          </p>
          <p>
            Our mission is to provide competitive esports opportunities to NYC high school students, building community, developing skills, and creating pathways to careers in gaming and technology. We believe that esports can be a powerful tool for student engagement, skill development, and career preparation.
          </p>
          <p>
            Through our organized leagues, live streaming infrastructure, and community events, we bring together students from across New York City to compete, learn, and grow together. Our platform showcases student talent and builds lasting connections between schools, students, and the broader esports community.
          </p>
        </div>
      </ContentSection>

      <ContentSection
        heading="WHAT WE DO"
        description=""
        theme="light"
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-4xl font-bold text-rose-300 mb-4">500+</div>
            <div className="text-xl font-semibold text-gray-900 mb-2">Concurrent Viewers</div>
            <div className="text-gray-600">Live broadcasts reaching audiences across NYC</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-rose-300 mb-4">100+</div>
            <div className="text-xl font-semibold text-gray-900 mb-2">Active Players</div>
            <div className="text-gray-600">Students competing across multiple games</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-rose-300 mb-4">15+</div>
            <div className="text-xl font-semibold text-gray-900 mb-2">Participating Schools</div>
            <div className="text-gray-600">High schools from all five boroughs</div>
          </div>
        </div>
      </ContentSection>

      <ContentSection
        heading="OUR VALUES"
        description=""
        theme="dark"
      >
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-2xl font-bold text-rose-300 mb-3">Accessibility</h3>
            <p className="text-gray-300">
              We believe esports should be accessible to all students, regardless of skill level or background. Our league structure accommodates both varsity and junior varsity divisions.
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-2xl font-bold text-rose-300 mb-3">Community</h3>
            <p className="text-gray-300">
              Building connections between students, schools, and the broader esports community is at the heart of what we do. We foster a supportive and inclusive environment.
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-2xl font-bold text-rose-300 mb-3">Excellence</h3>
            <p className="text-gray-300">
              We strive for excellence in competition, organization, and student development. Our structured leagues and professional streaming infrastructure reflect this commitment.
            </p>
          </div>
        </div>
      </ContentSection>
    </main>
  );
}



