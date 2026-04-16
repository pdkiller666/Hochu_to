import { Layout } from "@/components/layout/Layout";
import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useRegisterUser, useLoginUser, useGetRegions } from "@workspace/api-client-react";
import { useAuthState } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User as UserIcon, Phone, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Auth() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialTab = params.get("tab") === "register" ? "register" : "login";
  const initialRole = params.get("role") === "owner" ? "owner" : "renter";

  const [tab, setTab] = useState<"login" | "register">(initialTab);
  const [role, setRole] = useState<"renter" | "owner">(initialRole as any);
  
  const [, setLocation] = useLocation();
  const { login: setAuthToken } = useAuthState();
  const { toast } = useToast();
  
  const { data: regions } = useGetRegions();

  const registerMutation = useRegisterUser();
  const loginMutation = useLoginUser();

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [regionId, setRegionId] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (tab === "login") {
      loginMutation.mutate({ data: { email, password } }, {
        onSuccess: (res) => {
          setAuthToken(res.token);
          toast({ title: "С возвращением!", description: "Вы успешно вошли." });
          setLocation("/dashboard");
        },
        onError: (err: any) => {
          const body = err?.response?.data ?? err?.data ?? {};
          if (body?.error === "banned") {
            toast({ title: "Аккаунт заблокирован", description: body.message ?? "Обратитесь в поддержку.", variant: "destructive" });
          } else {
            toast({ title: "Ошибка входа", description: "Неверный email или пароль", variant: "destructive" });
          }
        }
      });
    } else {
      registerMutation.mutate({ 
        data: { email, password, name, phone, role, regionId: Number(regionId) } 
      }, {
        onSuccess: (res) => {
          setAuthToken(res.token);
          toast({ title: "Добро пожаловать!", description: "Регистрация успешна." });
          setLocation("/dashboard");
        },
        onError: () => {
          toast({ title: "Ошибка", description: "Пользователь с таким email уже существует или данные неверны", variant: "destructive" });
        }
      });
    }
  };

  return (
    <Layout>
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-primary/5">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel p-8 md:p-10 rounded-3xl w-full max-w-md shadow-2xl shadow-primary/10 bg-white"
        >
          <div className="flex bg-muted p-1 rounded-xl mb-8">
            <button 
              className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${tab === 'login' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setTab("login")}
            >
              Вход
            </button>
            <button 
              className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${tab === 'register' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setTab("register")}
            >
              Регистрация
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="popLayout">
              {tab === "register" && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="flex gap-2 mb-4">
                    <button type="button" onClick={() => setRole("renter")} className={`flex-1 py-2 px-3 text-sm rounded-xl border-2 transition-all ${role === 'renter' ? 'border-primary bg-primary/5 text-primary font-bold' : 'border-border text-muted-foreground'}`}>
                      Я Арендатор
                    </button>
                    <button type="button" onClick={() => setRole("owner")} className={`flex-1 py-2 px-3 text-sm rounded-xl border-2 transition-all ${role === 'owner' ? 'border-primary bg-primary/5 text-primary font-bold' : 'border-border text-muted-foreground'}`}>
                      Я Владелец
                    </button>
                  </div>

                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <input type="text" placeholder="Ваше Имя" required={tab === 'register'} value={name} onChange={e => setName(e.target.value)} className="input-field pl-11" />
                  </div>
                  
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <input type="tel" placeholder="Телефон" value={phone} onChange={e => setPhone(e.target.value)} className="input-field pl-11" />
                  </div>

                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <select required={tab === 'register'} value={regionId} onChange={e => setRegionId(e.target.value)} className="input-field pl-11 appearance-none">
                      <option value="" disabled>Выберите город</option>
                      {regions?.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input type="email" placeholder="Email" required value={email} onChange={e => setEmail(e.target.value)} className="input-field pl-11" />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input type="password" placeholder="Пароль" required value={password} onChange={e => setPassword(e.target.value)} className="input-field pl-11" />
            </div>

            <button 
              type="submit" 
              className="btn-primary w-full py-4 text-lg mt-6"
              disabled={loginMutation.isPending || registerMutation.isPending}
            >
              {loginMutation.isPending || registerMutation.isPending ? "Обработка..." : tab === "login" ? "Войти" : "Зарегистрироваться"}
            </button>
            
            {tab === "register" && (
              <p className="text-xs text-center text-muted-foreground mt-4">
                Нажимая кнопку, вы соглашаетесь с Политикой конфиденциальности.
              </p>
            )}
          </form>
        </motion.div>
      </div>
    </Layout>
  );
}
