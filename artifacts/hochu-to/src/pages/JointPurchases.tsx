import { Layout } from "@/components/layout/Layout";
import { useGetJointPurchases, useCreateJointPurchase } from "@workspace/api-client-react";
import { formatPrice } from "@/lib/utils";
import { Users, Target, ArrowRight, Clock } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function JointPurchases() {
  const { data: purchases, isLoading } = useGetJointPurchases();
  const createMutation = useCreateJointPurchase();
  const { toast } = useToast();

  const [form, setForm] = useState({
    itemName: "", targetAmount: "", description: "", contactEmail: ""
  });

  const handleParticipate = () => {
    toast({ title: "Скоро!", description: "Функция участия в покупке появится в следующем обновлении." });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      data: { ...form, targetAmount: Number(form.targetAmount) }
    }, {
      onSuccess: () => {
        toast({ title: "Успех!", description: "Заявка на совместную покупку создана."});
        setForm({ itemName: "", targetAmount: "", description: "", contactEmail: "" });
      }
    });
  };

  return (
    <Layout>
      <div className="bg-primary/5 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
            <h1 className="text-4xl md:text-5xl font-extrabold mb-6 text-foreground">
              Вместе дешевле.<br/>
              <span className="text-primary">Совместное владение</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Нужна дорогая вещь, но жалко покупать одному? Найдите единомышленников, скиньтесь и пользуйтесь по очереди. Идеально для дорогого тур.снаряжения, спец.техники или игровых приставок.
            </p>
            <a href="#create-request" className="btn-primary text-lg px-8 py-4">Предложить покупку</a>
          </div>
          <div className="flex-1">
            <img src={`${import.meta.env.BASE_URL}images/joint-purchase.png`} alt="Совместное владение" className="w-full rounded-3xl shadow-2xl shadow-primary/10" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold mb-8">Открытые сборы</h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {purchases?.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-border p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg leading-tight">{p.itemName}</h3>
                <span className="bg-accent/10 text-accent px-2 py-1 rounded-md text-xs font-bold shrink-0">Открыто</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6 line-clamp-2">{p.description}</p>
              
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-primary">{formatPrice(p.collectedAmount)}</span>
                  <span className="text-muted-foreground">из {formatPrice(p.targetAmount)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${Math.min(100, (p.collectedAmount / p.targetAmount) * 100)}%`}}></div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" /> {p.participantsCount} участников
                </div>
                <button onClick={handleParticipate} className="flex items-center gap-1 text-primary font-bold text-sm hover:underline">
                  <Clock className="w-3.5 h-3.5" />Участвовать
                </button>
              </div>
            </div>
          ))}
        </div>

        <div id="create-request" className="max-w-2xl mx-auto bg-card p-8 rounded-3xl border border-border">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2"><Target className="w-6 h-6 text-primary"/> Предложить покупку</h2>
          <p className="text-muted-foreground mb-6">Опишите что вы хотите купить и какую сумму нужно собрать.</p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1">Что покупаем?</label>
              <input required value={form.itemName} onChange={e=>setForm({...form, itemName: e.target.value})} type="text" className="input-field" placeholder="Sony PlayStation 5 Pro" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Необходимая сумма (₽)</label>
              <input required value={form.targetAmount} onChange={e=>setForm({...form, targetAmount: e.target.value})} type="number" className="input-field" placeholder="80000" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Описание и условия</label>
              <textarea required value={form.description} onChange={e=>setForm({...form, description: e.target.value})} className="input-field min-h-[100px]" placeholder="Будем пользоваться по 2 недели по очереди..."></textarea>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Ваш Email для связи</label>
              <input required value={form.contactEmail} onChange={e=>setForm({...form, contactEmail: e.target.value})} type="email" className="input-field" placeholder="hello@example.com" />
            </div>
            <button disabled={createMutation.isPending} type="submit" className="btn-primary w-full mt-4">
              Создать заявку <ArrowRight className="w-5 h-5 ml-2" />
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
