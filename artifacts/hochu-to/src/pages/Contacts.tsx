import { Layout } from "@/components/layout/Layout";
import { Mail, MapPin, Phone } from "lucide-react";
import { useState } from "react";
import { useSubmitContactForm } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export default function Contacts() {
  const { toast } = useToast();
  const mutation = useSubmitContactForm();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ data: form }, {
      onSuccess: () => {
        toast({ title: "Успешно!", description: "Ваше сообщение отправлено." });
        setForm({ name: "", email: "", subject: "", message: "" });
      }
    });
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-16 grid lg:grid-cols-2 gap-16">
        <div>
          <h1 className="text-4xl font-extrabold mb-6">Свяжитесь с нами</h1>
          <p className="text-lg text-muted-foreground mb-12">
            Возникли вопросы, предложения или нужна помощь? Напишите нам, мы отвечаем быстро.
          </p>

          <div className="space-y-8">
            <div className="flex gap-4 items-center">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-muted-foreground">Email</h4>
                <p className="text-lg font-medium">hello@hochu-to.ru</p>
              </div>
            </div>
            <div className="flex gap-4 items-center">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-muted-foreground">Офис</h4>
                <p className="text-lg font-medium">г. Москва, ул. Примерная, 10</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card p-8 rounded-3xl border border-border">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">Ваше имя</label>
                <input required value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className="input-field" type="text" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Email</label>
                <input required value={form.email} onChange={e=>setForm({...form, email: e.target.value})} className="input-field" type="email" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">Тема</label>
              <input value={form.subject} onChange={e=>setForm({...form, subject: e.target.value})} className="input-field" type="text" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">Сообщение</label>
              <textarea required value={form.message} onChange={e=>setForm({...form, message: e.target.value})} className="input-field min-h-[150px]"></textarea>
            </div>
            <button disabled={mutation.isPending} type="submit" className="btn-primary w-full mt-4">
              {mutation.isPending ? "Отправка..." : "Отправить сообщение"}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
