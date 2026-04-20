import { Layout } from "@/components/layout/Layout";
import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useCreateListing, useUpdateListing, useGetListingById, useGetCategories, useGetRegions } from "@workspace/api-client-react";
import { useAuthState } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Loader2, ImagePlus, X, ShieldCheck, ShieldOff, AlertTriangle, Info } from "lucide-react";
import { Link } from "wouter";
import { LocationPicker } from "@/components/ui/LocationPicker";
import { calculateTotalPrice, calcMaxProtectionLimit, calcDeposit, calcFundContribution, ITEM_CATEGORY_LABELS, CATEGORY_AVG_PRICE, type ItemCategory } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_URL ?? "";
const DRAFT_KEY = "hochu_to_listing_draft";

export default function ListingForm() {
  const [, params] = useRoute("/dashboard/listings/:id/edit");
  const isEditing = !!params?.id;
  const id = Number(params?.id);

  const { isAuthenticated, isAuthLoading, token } = useAuthState();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: categories } = useGetCategories();
  const { data: regions } = useGetRegions();

  const { data: listingData, isLoading: isLoadingListing } = useGetListingById(id, {
    query: { enabled: isEditing } as any,
  });

  const createMutation = useCreateListing({ request: { headers: { Authorization: `Bearer ${token}` } } });
  const updateMutation = useUpdateListing({ request: { headers: { Authorization: `Bearer ${token}` } } });

  type FormDataShape = {
    title: string;
    description: string;
    pricePerDay: string;
    categoryId: string;
    regionId: string;
    city: string;
    itemCategory: "" | "electronics" | "tools" | "leisure";
    ownerProtectionEnabled: boolean;
    isAvailable: boolean;
    lat: number | null;
    lng: number | null;
    meetingAddress: string;
  };

  const defaultFormData: FormDataShape = {
    title: "",
    description: "",
    pricePerDay: "",
    categoryId: "",
    regionId: "",
    city: "",
    itemCategory: "",
    ownerProtectionEnabled: true,
    isAvailable: true,
    lat: null,
    lng: null,
    meetingAddress: "",
  };

  const [formData, setFormData] = useState<FormDataShape>(() => {
    if (!isEditing) {
      try {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return { ...defaultFormData, ...parsed.formData };
        }
      } catch {}
    }
    return defaultFormData;
  });

  const [photos, setPhotos] = useState<string[]>(() => {
    if (!isEditing) {
      try {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.photos ?? [];
        }
      } catch {}
    }
    return [];
  });

  const [uploading, setUploading] = useState(false);
  const uploadInputId = "photo-upload-input";

  // Автосохранение черновика для новых объявлений
  useEffect(() => {
    if (!isEditing) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ formData, photos }));
      } catch {}
    }
  }, [formData, photos, isEditing]);

  useEffect(() => {
    // Ждём завершения начальной проверки сессии, иначе форма очищается
    // в момент временного isAuthenticated=false при обновлении токена
    if (!isAuthLoading && !isAuthenticated) setLocation("/auth");
  }, [isAuthenticated, isAuthLoading]);

  useEffect(() => {
    if (isEditing && listingData) {
      setFormData({
        title: listingData.title,
        description: listingData.description || "",
        pricePerDay: listingData.pricePerDay.toString(),
        categoryId: listingData.categoryId.toString(),
        regionId: listingData.regionId.toString(),
        city: (listingData as any).city || "",
        itemCategory: (listingData as any).itemCategory || "",
        ownerProtectionEnabled: (listingData as any).ownerProtectionEnabled !== false,
        lat: (listingData as any).lat ?? null,
        lng: (listingData as any).lng ?? null,
        meetingAddress: (listingData as any).meetingAddress || "",
        isAvailable: listingData.isAvailable,
      });
      setPhotos(listingData.photos ?? []);
    }
  }, [isEditing, listingData]);

  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (photos.length + files.length > 10) {
      toast({ title: "Максимум 10 фото", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      files.forEach(f => form.append("photos", f));

      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) throw new Error("Ошибка загрузки");

      const { urls } = await res.json() as { urls: string[] };
      setPhotos(prev => [...prev, ...urls]);
    } catch {
      toast({ title: "Не удалось загрузить фото", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const setMainPhoto = (index: number) => {
    setPhotos(prev => {
      const next = [...prev];
      const [picked] = next.splice(index, 1);
      return [picked, ...next];
    });
  };

  const getPhotoSrc = (url: string) =>
    url.startsWith("http") ? url : `${API_BASE}${url}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.pricePerDay || Number(formData.pricePerDay) < 100) {
      toast({ title: "Минимальная цена — 100 ₽/сутки", variant: "destructive" });
      return;
    }

    const payload = {
      title: formData.title,
      description: formData.description,
      pricePerDay: Number(formData.pricePerDay),
      categoryId: Number(formData.categoryId),
      regionId: Number(formData.regionId),
      city: formData.city.trim() || undefined,
      lat: formData.lat ?? undefined,
      lng: formData.lng ?? undefined,
      meetingAddress: formData.meetingAddress.trim() || undefined,
      itemCategory: (formData.itemCategory || undefined) as "electronics" | "tools" | "leisure" | undefined,
      ownerProtectionEnabled: formData.ownerProtectionEnabled,
      isAvailable: formData.isAvailable,
      photos,
    };

    if (isEditing) {
      updateMutation.mutate({ id, data: payload as any }, {
        onSuccess: () => {
          toast({ title: "Сохранено", description: "Изменения успешно применены" });
          setLocation("/dashboard");
        },
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: () => {
          try { localStorage.removeItem(DRAFT_KEY); } catch {}
          toast({ title: "Успех", description: "Объявление добавлено" });
          setLocation("/dashboard");
        },
      });
    }
  };

  if (isEditing && isLoadingListing) {
    return <Layout><div className="flex h-screen items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div></Layout>;
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Layout>
      <div className="bg-card border-b border-border py-4">
        <div className="max-w-3xl mx-auto px-4">
          <Link href="/dashboard" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary">
            <ChevronLeft className="w-4 h-4 mr-1" /> В личный кабинет
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">
          {isEditing ? "Редактирование вещи" : "Добавление новой вещи"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 md:p-8 rounded-3xl border border-border shadow-sm">

          <div className="space-y-4">
            <h3 className="text-xl font-bold">Основная информация</h3>
            <div>
              <label className="block text-sm font-bold mb-2">Название</label>
              <input required type="text" className="input-field" placeholder="Например: Перфоратор Makita" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">Категория</label>
                <select required className="input-field appearance-none" value={formData.categoryId} onChange={e => setFormData({ ...formData, categoryId: e.target.value })}>
                  <option value="" disabled>Выберите...</option>
                  {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Регион (город)</label>
                <select required className="input-field appearance-none" value={formData.regionId} onChange={e => setFormData({ ...formData, regionId: e.target.value })}>
                  <option value="" disabled>Выберите...</option>
                  {regions?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">
                Район / метро / населённый пункт <span className="text-muted-foreground font-normal">(необязательно)</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Например: Арбат, Центральный район, м. Сокольники"
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground mt-1">Это поможет арендаторам точнее понять, где находится вещь</p>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">
                Точка на карте <span className="text-muted-foreground font-normal">(необязательно)</span>
              </label>
              <LocationPicker
                lat={formData.lat}
                lng={formData.lng}
                onChange={coords => setFormData(prev => ({
                  ...prev,
                  lat: coords?.lat ?? null,
                  lng: coords?.lng ?? null,
                }))}
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">
                Место передачи вещи <span className="text-muted-foreground font-normal">(необязательно)</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Например: у метро Сокольники, выход №3 / ТЦ «Европейский», 1 этаж"
                value={formData.meetingAddress}
                onChange={e => setFormData({ ...formData, meetingAddress: e.target.value })}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground mt-1">Где и как вам удобно встретиться с арендатором для передачи вещи</p>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">Описание</label>
              <textarea required className="input-field min-h-[120px] resize-y" placeholder="Опишите состояние, комплектацию, условия возврата..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}></textarea>
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-border">
            <h3 className="text-xl font-bold">Цены и условия</h3>

            {/* ─── Цена и категория защиты ──────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">Цена за сутки (₽) <span className="text-red-500">*</span></label>
                <input
                  required
                  type="number"
                  min="100"
                  step="1"
                  className="input-field"
                  placeholder="Минимум 100 ₽"
                  value={formData.pricePerDay}
                  onChange={e => setFormData({ ...formData, pricePerDay: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">Минимальная цена: 100 ₽/сутки</p>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Категория для защиты фонда</label>
                <select
                  className="input-field appearance-none"
                  value={formData.itemCategory}
                  onChange={e => setFormData({ ...formData, itemCategory: e.target.value as any })}
                >
                  <option value="">Не указана (инструменты по умолчанию)</option>
                  <option value="electronics">Электроника (множитель ×60)</option>
                  <option value="tools">Инструменты (множитель ×30)</option>
                  <option value="leisure">Отдых и спорт (множитель ×15)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">Определяет лимит компенсации из фонда</p>
              </div>
            </div>

            {/* ─── Live Preview: защита + залог ────────────────────────────── */}
            {formData.pricePerDay && Number(formData.pricePerDay) >= 100 && (() => {
              const ppd = Number(formData.pricePerDay);
              const cat = (formData.itemCategory || "tools") as ItemCategory;
              const avgPrice = CATEGORY_AVG_PRICE[cat];
              const isAnomaly = ppd > avgPrice * 3;
              const maxProt = calcMaxProtectionLimit(ppd, cat, 0); // 0 сделок — самый консервативный кап
              const deposit = calcDeposit(ppd);
              const fundPerDay = calcFundContribution(maxProt);
              const { rent, combinedServiceFee, total } = calculateTotalPrice(ppd, cat, 1, formData.ownerProtectionEnabled);

              return (
                <div className="space-y-3">
                  {/* Аномальная цена */}
                  {isAnomaly && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-xl p-3 text-sm">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-amber-800">
                        <strong>Высокая цена аренды.</strong> Для категории «{ITEM_CATEGORY_LABELS[cat]}» средняя цена — {avgPrice.toLocaleString("ru")} ₽/сутки.
                        Объявление попадёт на ручную проверку модератором перед публикацией.
                      </p>
                    </div>
                  )}

                  {/* Preview-карточка */}
                  <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
                    <p className="text-sm font-bold text-foreground">Ваша защита и условия для арендатора</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-xl p-3 text-center border border-border">
                        <p className="text-xs text-muted-foreground mb-1">Ваша защита (фонд)</p>
                        <p className="text-lg font-black text-primary">{maxProt.toLocaleString("ru")} ₽</p>
                        {maxProt <= 25_000 && <p className="text-[10px] text-amber-600 mt-0.5">кап для новых аккаунтов</p>}
                      </div>
                      <div className="bg-white rounded-xl p-3 text-center border border-border">
                        <p className="text-xs text-muted-foreground mb-1">Залог арендатора</p>
                        <p className="text-lg font-black text-foreground">{deposit.toLocaleString("ru")} ₽</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">возврат после аренды</p>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-3 text-sm space-y-1 border border-border">
                      <p className="font-semibold text-foreground text-xs mb-1.5">Что видит арендатор за 1 сутки</p>
                      <div className="flex justify-between text-muted-foreground text-xs"><span>Аренда</span><span>{rent.toLocaleString("ru")} ₽</span></div>
                      <div className="flex justify-between text-muted-foreground text-xs">
                        <span>Комиссия сервиса {formData.ownerProtectionEnabled ? `(включая взнос ${fundPerDay.toLocaleString("ru")} ₽ в фонд)` : ""}</span>
                        <span>{combinedServiceFee.toLocaleString("ru", { maximumFractionDigits: 0 })} ₽</span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-border pt-1 text-xs text-foreground"><span>Итого</span><span>{total.toLocaleString("ru", { maximumFractionDigits: 0 })} ₽</span></div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ─── Тоггл Гарантийного фонда для владельца ─────────────────── */}
            <div className={`rounded-2xl border-2 p-4 transition-colors ${formData.ownerProtectionEnabled ? "border-primary/30 bg-primary/5" : "border-amber-300 bg-amber-50"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {formData.ownerProtectionEnabled
                    ? <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    : <ShieldOff className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  }
                  <div>
                    <p className={`font-bold text-sm ${formData.ownerProtectionEnabled ? "text-primary" : "text-amber-800"}`}>
                      {formData.ownerProtectionEnabled ? "Гарантийный фонд подключён" : "Гарантийный фонд отключён"}
                    </p>
                    {formData.ownerProtectionEnabled ? (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                        Взнос включён в комиссию сервиса. При подтверждённом повреждении — компенсация до лимита фонда. Без автоматических выплат, всё через модератора.
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700 mt-0.5 leading-tight">
                        ⚠️ Без фонда вы несёте весь риск самостоятельно. При повреждении вещи компенсация не гарантирована.
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.ownerProtectionEnabled}
                  onClick={() => setFormData({ ...formData, ownerProtectionEnabled: !formData.ownerProtectionEnabled })}
                  className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${formData.ownerProtectionEnabled ? "bg-primary" : "bg-amber-400"}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${formData.ownerProtectionEnabled ? "left-7" : "left-1"}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Фотографии</h3>
                <p className="text-sm text-muted-foreground mt-0.5">До 10 фото с вашего устройства</p>
              </div>
              <label
                htmlFor={uploadInputId}
                aria-disabled={uploading || photos.length >= 10}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold cursor-pointer hover:bg-primary/90 transition-colors aria-disabled:opacity-50 aria-disabled:pointer-events-none"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                {uploading ? "Загрузка..." : "Добавить фото"}
              </label>
              <input
                id={uploadInputId}
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                disabled={uploading || photos.length >= 10}
                className="sr-only"
                onChange={handleFilesChange}
              />
            </div>

            {photos.length === 0 ? (
              <label
                htmlFor={uploadInputId}
                className="w-full h-40 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer"
              >
                <ImagePlus className="w-10 h-10" />
                <span className="text-sm font-medium">Нажмите чтобы выбрать фото</span>
              </label>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {photos.map((url, i) => (
                  <div key={url + i} className="relative aspect-square rounded-xl overflow-hidden bg-muted border-2 border-border group transition-all"
                    style={i === 0 ? { borderColor: "var(--primary)" } : {}}>
                    <img
                      src={getPhotoSrc(url)}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={e => { (e.currentTarget as HTMLImageElement).src = "https://placehold.co/200x200?text=Фото"; }}
                    />
                    {i === 0 ? (
                      <span className="absolute bottom-1 left-1 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">★ Главное</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setMainPhoto(i)}
                        className="absolute bottom-1 left-1 right-7 bg-black/60 hover:bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity truncate"
                      >
                        Сделать главным
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {photos.length < 10 && (
                  <label
                    htmlFor={uploadInputId}
                    className="aspect-square rounded-xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer"
                  >
                    <ImagePlus className="w-6 h-6" />
                  </label>
                )}
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-border flex items-center justify-between">
            <label
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => setFormData(prev => ({ ...prev, isAvailable: !prev.isAvailable }))}
            >
              <div className={`w-12 h-6 rounded-full p-1 transition-colors ${formData.isAvailable ? "bg-primary" : "bg-muted-foreground"}`}>
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${formData.isAvailable ? "translate-x-6" : "translate-x-0"}`}></div>
              </div>
              <span className="font-bold">Доступно для аренды</span>
            </label>

            <button type="submit" disabled={isPending || uploading} className="btn-primary">
              {isPending ? "Сохранение..." : isEditing ? "Сохранить изменения" : "Опубликовать вещь"}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
