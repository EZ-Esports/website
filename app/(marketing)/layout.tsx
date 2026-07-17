import Header from "@/app/components/layout/Header";
import Footer from "@/app/components/layout/Footer";
import MainContentWrapper from "./MainContentWrapper";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-surface text-foreground flex flex-col">
      <Header />
      <MainContentWrapper>
        {children}
      </MainContentWrapper>
      <Footer />
    </div>
  );
}



