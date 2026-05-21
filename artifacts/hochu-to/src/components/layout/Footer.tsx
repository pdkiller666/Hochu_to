import { Link } from "wouter";
import { Send, MapPin, Phone, Mail, Instagram, Twitter } from "lucide-react";
import { useSubscribeNewsletter } from "@workspace/api-client-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function Footer() {
  const { mutate: subscribe, isPending } = useSubscribeNewsletter();
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    subscribe({ data: { email } }, {
      onSuccess: () => {
        toast({ title: "Успешно!", description: "Вы подписаны на наши новости." });
        setEmail("");
      },
      onError: () => {
        toast({ title: "Ошибка", description: "Что-то пошло не так. Попробуйте позже.", variant: "destructive" });
      }
    });
  };

  return (
    <footer className="bg-card pt-16 pb-8 border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          
          {/* Brand Col */}
          <div className="space-y-6">
            <Link href="/" className="flex items-center gap-2 inline-flex">
              <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-display font-black text-xl">
                Х_Т
              </div>
              <span className="font-display font-extrabold text-2xl tracking-tight text-foreground">
                Хочу<span className="text-primary">_То</span>
              </span>
            </Link>
            <p className="text-muted-foreground leading-relaxed">
              Первый дружелюбный маркетплейс аренды вещей и совместных покупок. Делитесь, экономьте, спасайте планету вместе с нами.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" /></svg>
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M11.999 7.377a4.623 4.623 0 1 0 0 9.248 4.623 4.623 0 0 0 0-9.248zm0 7.627a3.004 3.004 0 1 1 0-6.008 3.004 3.004 0 0 1 0 6.008z"/><circle cx="16.806" cy="7.207" r="1.078"/><path d="M20.533 6.111A4.605 4.605 0 0 0 17.9 3.479a6.606 6.606 0 0 0-2.186-.42c-.963-.042-1.268-.054-3.71-.054s-2.755 0-3.71.054a6.554 6.554 0 0 0-2.184.42 4.6 4.6 0 0 0-2.633 2.632 6.585 6.585 0 0 0-.419 2.186c-.043.962-.056 1.267-.056 3.71 0 2.442 0 2.753.056 3.71.015.748.156 1.486.419 2.187a4.61 4.61 0 0 0 2.634 2.632 6.584 6.584 0 0 0 2.185.45c.963.042 1.268.055 3.71.055s2.755 0 3.71-.055a6.615 6.615 0 0 0 2.186-.419 4.613 4.613 0 0 0 2.633-2.633c.263-.7.404-1.438.419-2.186.043-.962.056-1.267.056-3.71s0-2.753-.056-3.71a6.581 6.581 0 0 0-.421-2.217zm-1.218 9.532a5.043 5.043 0 0 1-.311 1.688 2.987 2.987 0 0 1-1.712 1.711 4.985 4.985 0 0 1-1.67.311c-.95.044-1.218.055-3.654.055-2.438 0-2.687 0-3.655-.055a4.96 4.96 0 0 1-1.669-.311 2.985 2.985 0 0 1-1.719-1.711 5.08 5.08 0 0 1-.311-1.669c-.043-.95-.053-1.218-.053-3.654 0-2.437 0-2.686.053-3.655a5.038 5.038 0 0 1 .311-1.687c.305-.789.93-1.41 1.719-1.712a5.01 5.01 0 0 1 1.669-.311c.951-.043 1.218-.055 3.655-.055s2.687 0 3.654.055a4.96 4.96 0 0 1 1.67.311 2.991 2.991 0 0 1 1.712 1.712 5.08 5.08 0 0 1 .311 1.669c.043.951.054 1.218.054 3.655 0 2.436 0 2.698-.043 3.654h-.011z"/></svg>
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.94z"/></svg>
              </a>
            </div>
          </div>

          {/* Links Col 1 */}
          <div>
            <h4 className="font-bold text-lg mb-6">Платформа</h4>
            <ul className="space-y-4">
              <li><Link href="/catalog" className="text-muted-foreground hover:text-primary transition-colors">Каталог вещей</Link></li>
              <li><Link href="/pools" className="text-muted-foreground hover:text-primary transition-colors">Совместное владение</Link></li>
              <li><Link href="/how-to-rent" className="text-muted-foreground hover:text-primary transition-colors">Как арендовать</Link></li>
              <li><Link href="/how-to-list" className="text-muted-foreground hover:text-primary transition-colors">Как сдать в аренду</Link></li>
              <li><Link href="/guarantee-fund" className="text-muted-foreground hover:text-primary transition-colors">Гарантийный фонд</Link></li>
            </ul>
          </div>

          {/* Links Col 2 */}
          <div>
            <h4 className="font-bold text-lg mb-6">О компании</h4>
            <ul className="space-y-4">
              <li><Link href="/about" className="text-muted-foreground hover:text-primary transition-colors">О нас</Link></li>
              <li><Link href="/contacts" className="text-muted-foreground hover:text-primary transition-colors">Контакты</Link></li>
              <li><Link href="/privacy" className="text-muted-foreground hover:text-primary transition-colors">Политика конфиденциальности</Link></li>
              <li><Link href="/terms" className="text-muted-foreground hover:text-primary transition-colors">Пользовательское соглашение</Link></li>
            </ul>
          </div>

          {/* Newsletter Col */}
          <div>
            <h4 className="font-bold text-lg mb-6">Подписка на новости</h4>
            <p className="text-muted-foreground text-sm mb-4">
              Узнавайте первыми о новых крутых вещах в вашем городе и акциях.
            </p>
            <form onSubmit={handleSubscribe} className="flex gap-2">
              <input 
                type="email" 
                placeholder="Ваш email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-field py-2"
              />
              <button 
                type="submit" 
                disabled={isPending}
                className="w-12 h-12 flex-shrink-0 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>

        </div>

        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Хочу_То. Все права защищены.</p>
          <div className="flex items-center gap-1">
            Сделано с <span className="text-destructive">♥</span> для разумного потребления
          </div>
        </div>
      </div>
    </footer>
  );
}
