import { Header } from "./Header";
import { Footer } from "./Footer";
import { BottomNav } from "@/components/BottomNav";
import { motion } from "framer-motion";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col w-full bg-background selection:bg-primary/20 selection:text-primary">
      <Header />
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex-grow w-full pb-14 md:pb-0"
      >
        {children}
      </motion.main>
      <div className="hidden md:block">
        <Footer />
      </div>
      <BottomNav />
    </div>
  );
}
