import Header from "@/app/components/layout/Header";
import Footer from "@/app/components/layout/Footer";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="theme-graphite min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <div id="main-content" tabIndex={-1} className="flex-grow">
        {children}
      </div>
      <Footer />
    </div>
  );
}



