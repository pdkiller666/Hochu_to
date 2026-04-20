import { Layout } from "@/components/layout/Layout";
import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useCreateListing, useUpdateListing, useGetListingById, useGetCategories, useGetRegions } from "@workspace/api-client-react";
import { useAuthState } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Loader2, ImagePlus, X, ShieldCheck, ShieldOff, AlertTriangle, Info, HandCoins } from "lucide-react";
import { Link } from "wouter";
import { LocationPicker } from "@/components/ui/LocationPicker";
import { CollapsibleMap } from "@/components/ui/CollapsibleMap";
import { calculateTotalPrice, calcMaxProtectionLimit, calcDeposit, ITEM_CATEGORY_LABELS, CATEGORY_AVG_PRICE, mapCategorySlugToItemCategory, type ItemCategory } from "@/lib/utils";

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
    ownerProtectionEnabled: boolean;
    /** Ручной залог (₽). Используется только если ownerProtectionEnabled=false. */
    manualDeposit: string;
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
    ownerProtectionEnabled: true,
    manualDeposit: "",
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
      const dep = (listingData as any).deposit;
      setFormData({
        title: listingData.title,
        description: listingData.description || "",
        pricePerDay: listingData.pricePerDay.toString(),
        categoryId: listingData.categoryId.toString(),
        regionId: listingData.regionId.toString(),
        city: (listingData as any).city || "",
        ownerProtectionEnabled: (listingData as any).ownerProtectionEnabled !== false,
        manualDeposit: dep ? String(dep) : "",
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

    // Авто-маппинг основной категории в категорию защитного фонда
    const selectedCategory = categories?.find(c => c.id === Number(formData.categoryId));
    const itemCategory = mapCategorySlugToItemCategory(selectedCategory?.slug);

    // Залог: при включённой Безопасной сделке — undefined (рассчитается автоматически).
    // При прямой аренде — обязательное поле, минимум 500 ₽.
    let depositValue: number | undefined;
    if (!formData.ownerProtectionEnabled) {
      const dep = Number(formData.manualDeposit);
      if (!formData.manualDeposit || isNaN(dep) || dep < 500) {
        toast({
          title: "Укажите залог",
          description: "При прямой аренде укажите залог не меньше 500 ₽ — это ваша единственная страховка.",
          variant: "destructive",
        });
        return;
      }
      depositValue = dep;
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
      itemCategory: itemCategory as "electronics" | "tools" | "leisure",
      ownerProtectionEnabled: formData.ownerProtectionEnabled,
      deposit: depositValue,
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
              <CollapsibleMap
                label={formData.lat && formData.lng ? "Карта — метка установлена" : "Поставить метку на карте"}
                hint="Точная метка повышает доверие арендаторов и количество откликов"
                defaultOpen={!!(formData.lat && formData.lng)}
              >
                <LocationPicker
                  lat={formData.lat}
                  lng={formData.lng}
                  onChange={coords => setFormData(prev => ({
                    ...prev,
                    lat: coords?.lat ?? null,
                    lng: coords?.lng ?? null,
                  }))}
                />
              </CollapsibleMap>
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
            <h3 className="text-xl font-bold">Цена и условия</h3>

            {/* ─── Цена за сутки ─────────────────────────────────────────── */}
            <div>
              <label className="block text-sm font-bold mb-2">Цена за сутки (₽) <span className="text-red-500">*</span></label>
              <input
                required
                type="number"
                min="100"
                step="1"
                className="input-field max-w-xs"
                placeholder="Минимум 100 ₽"
                value={formData.pricePerDay}
                onChange={e => setFormData({ ...formData, pricePerDay: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">Минимальная цена: 100 ₽/сутки</p>
            </div>

            {/* ─── Выбор формата сделки ─────────────────────────────────── */}
            <div className="space-y-3">
              <label className="block text-sm font-bold">Формат сделки</label>
              <p className="text-xs text-muted-foreground -mt-2">
                Выберите честно: работать через нашу защиту или напрямую с арендатором — решать вам.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Безопасная сделка */}
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, ownerProtectionEnabled: true })}
                  aria-pressed={formData.ownerProtectionEnabled}
                  className={`text-left p-4 rounded-2xl border-2 transition-all relative ${
                    formData.ownerProtectionEnabled
                      ? "border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md ring-2 ring-green-200/60"
                      : "border-green-200 bg-green-50/40 hover:border-green-400 hover:bg-green-50"
                  }`}
                >
                  {formData.ownerProtectionEnabled && (
                    <span className="absolute -top-2 -right-2 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm uppercase tracking-wide">
                      ✓ выбрано
                    </span>
                  )}
                  <div className="flex items-start gap-2.5 mb-2">
                    <ShieldCheck className={`w-5 h-5 shrink-0 mt-0.5 ${formData.ownerProtectionEnabled ? "text-green-600" : "text-green-500/70"}`} />
                    <div className="flex-1">
                      <p className={`font-bold text-sm ${formData.ownerProtectionEnabled ? "text-green-800" : "text-green-700"}`}>
                        Безопасная сделка
                      </p>
                      <p className="text-[11px] text-green-700/80 font-medium">рекомендуем</p>
                    </div>
                  </div>
                  <ul className={`text-xs space-y-1 leading-relaxed ${formData.ownerProtectionEnabled ? "text-green-900/80" : "text-muted-foreground"}`}>
                    <li><span className="text-green-600 font-bold">✓</span> Гарантированная выплата на карту</li>
                    <li><span className="text-green-600 font-bold">✓</span> Возмещение ущерба из фонда</li>
                    <li><span className="text-green-600 font-bold">✓</span> Решение споров платформой</li>
                    <li><span className="text-green-600 font-bold">✓</span> Бронируют в 2 раза чаще</li>
                  </ul>
                </button>

                {/* Прямая аренда */}
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, ownerProtectionEnabled: false })}
                  aria-pressed={!formData.ownerProtectionEnabled}
                  className={`text-left p-4 rounded-2xl border-2 transition-all ${
                    !formData.ownerProtectionEnabled
                      ? "border-slate-400 bg-slate-50 shadow-sm"
                      : "border-border bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start gap-2.5 mb-2">
                    <ShieldOff className={`w-5 h-5 shrink-0 mt-0.5 ${!formData.ownerProtectionEnabled ? "text-slate-700" : "text-muted-foreground"}`} />
                    <div className="flex-1">
                      <p className={`font-bold text-sm ${!formData.ownerProtectionEnabled ? "text-slate-800" : "text-foreground"}`}>
                        🪧 Объявление
                      </p>
                      <p className="text-[11px] text-emerald-700 font-bold">бесплатно</p>
                    </div>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1 leading-relaxed">
                    <li><span className="text-emerald-600 font-bold">✓</span> Получаете 100% от арендатора</li>
                    <li><span className="text-emerald-600 font-bold">✓</span> Размещение, поиск, чат, карта — всё бесплатно</li>
                    <li><span className="text-slate-500">•</span> Сделку проводите лично, как удобно</li>
                    <li><span className="text-slate-500">•</span> Без эскроу, страховки и помощи в спорах</li>
                  </ul>
                </button>
              </div>
            </div>

            {/* ─── Live Preview ─────────────────────────────────────────── */}
            {formData.pricePerDay && Number(formData.pricePerDay) >= 100 && (() => {
              const ppd = Number(formData.pricePerDay);
              const selectedCategory = categories?.find(c => c.id === Number(formData.categoryId));
              const cat = mapCategorySlugToItemCategory(selectedCategory?.slug);
              const avgPrice = CATEGORY_AVG_PRICE[cat];
              const isAnomaly = ppd > avgPrice * 3;
              const maxProt = calcMaxProtectionLimit(ppd, cat, 0);
              const autoDeposit = calcDeposit(ppd);
              const manualDep = Number(formData.manualDeposit);
              const depositToShow = formData.ownerProtectionEnabled
                ? autoDeposit
                : (manualDep > 0 ? manualDep : autoDeposit);
              const { rent, combinedServiceFee, total, ownerPayout } = calculateTotalPrice(ppd, cat, 1, formData.ownerProtectionEnabled);
              const ownerCut = rent - ownerPayout;
              const ownerCutPct = rent > 0 ? Math.round((ownerCut / rent) * 100) : 0;

              return (
                <div className="space-y-3">
                  {/* Аномальная цена */}
                  {isAnomaly && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-xl p-3 text-sm">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-amber-800">
                        <strong>Высокая цена аренды.</strong> Для категории «{ITEM_CATEGORY_LABELS[cat]}» средняя — {avgPrice.toLocaleString("ru")} ₽/сутки.
                        Объявление пройдёт ручную проверку модератором перед публикацией.
                      </p>
                    </div>
                  )}

                  {/* Preview-карточка */}
                  <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
                    <p className="text-sm font-bold text-foreground">Ваши условия за 1 сутки</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-xl p-3 text-center border border-green-200 relative group">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <p className="text-xs text-muted-foreground">Вы получите на руки</p>
                          <button
                            type="button"
                            tabIndex={0}
                            aria-label="Откуда такая сумма"
                            className="w-4 h-4 rounded-full bg-muted text-muted-foreground hover:bg-primary hover:text-white focus:bg-primary focus:text-white transition-colors flex items-center justify-center cursor-help"
                          >
                            <Info className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        <p className={`text-lg font-black ${formData.ownerProtectionEnabled ? "text-green-700" : "text-emerald-600"}`}>
                          {ownerPayout.toLocaleString("ru", { maximumFractionDigits: 0 })} ₽
                          {!formData.ownerProtectionEnabled && <span className="text-xs font-bold text-emerald-700 ml-1">(100%)</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formData.ownerProtectionEnabled ? "выплата на карту через 24 ч" : "лично от арендатора"}
                        </p>

                        {/* Подсказка с разбивкой суммы */}
                        <div
                          role="tooltip"
                          className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+8px)] w-64 max-w-[80vw] bg-foreground text-white text-[11px] rounded-xl p-3 shadow-xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-20 leading-relaxed text-left"
                        >
                          {formData.ownerProtectionEnabled ? (
                            <>
                              <p className="font-bold mb-1.5 text-white">Откуда такая сумма?</p>
                              <div className="space-y-0.5 text-white/90">
                                <div className="flex justify-between"><span>Цена аренды</span><span>{rent.toLocaleString("ru")} ₽</span></div>
                                <div className="flex justify-between text-white/70"><span>− Сервис платформы (10%)</span><span>−{(rent * 0.10).toLocaleString("ru", { maximumFractionDigits: 0 })} ₽</span></div>
                                <div className="flex justify-between text-white/70"><span>− Налоговая компенсация (6%)</span><span>−{(rent * 0.06).toLocaleString("ru", { maximumFractionDigits: 0 })} ₽</span></div>
                                <div className="flex justify-between text-white/70"><span>− Страховое покрытие (5%)</span><span>−{Math.max(rent * 0.05, 100).toLocaleString("ru", { maximumFractionDigits: 0 })} ₽</span></div>
                                <div className="flex justify-between font-bold border-t border-white/20 pt-1 mt-1 text-green-300">
                                  <span>= К выплате</span>
                                  <span>{ownerPayout.toLocaleString("ru", { maximumFractionDigits: 0 })} ₽</span>
                                </div>
                              </div>
                              <p className="mt-2 text-white/70 text-[10px] leading-snug">
                                Это плата за эскроу, страхование вещи, помощь в спорах и налоги — мы берём всё на себя.
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="font-bold mb-1.5 text-white">Полная сумма — ваша</p>
                              <p className="text-white/85 text-[11px] leading-snug">
                                Размещение бесплатное. Платформа <strong className="text-emerald-300">не удерживает ни копейки</strong> с аренды — все {rent.toLocaleString("ru")} ₽ вы получаете лично от арендатора.
                              </p>
                              <p className="mt-2 text-white/70 text-[10px] leading-snug">
                                Зарабатываем мы на тех арендаторах, кто покупает доступ к контактам. Так вам приходят только серьёзные люди.
                              </p>
                            </>
                          )}
                          <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-foreground" />
                        </div>
                      </div>
                      <div className={`bg-white rounded-xl p-3 text-center border ${formData.ownerProtectionEnabled ? "border-primary/20" : "border-slate-200"}`}>
                        <p className="text-xs text-muted-foreground mb-1">
                          {formData.ownerProtectionEnabled ? "Ваша вещь защищена на" : "Гарантия от платформы"}
                        </p>
                        <p className={`text-lg font-black ${formData.ownerProtectionEnabled ? "text-primary" : "text-slate-700"}`}>
                          {formData.ownerProtectionEnabled ? `${maxProt.toLocaleString("ru")} ₽` : "Своими силами"}
                        </p>
                        {formData.ownerProtectionEnabled && maxProt <= 25_000 && (
                          <p className="text-[10px] text-amber-600 mt-0.5">лимит для новых аккаунтов</p>
                        )}
                        {!formData.ownerProtectionEnabled && (
                          <p className="text-[10px] text-slate-500 mt-0.5">залог + расписка</p>
                        )}
                      </div>
                    </div>

                    {/* Объяснение «почему сумма меньше» — только при защищённой сделке */}
                    {formData.ownerProtectionEnabled && ownerCut > 0 && (
                      <div className="bg-white rounded-xl p-3 border border-border">
                        <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-primary" />
                          Почему вы получаете {ownerPayout.toLocaleString("ru", { maximumFractionDigits: 0 })} ₽, а не {rent.toLocaleString("ru")} ₽
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">
                          {ownerCut.toLocaleString("ru", { maximumFractionDigits: 0 })} ₽ ({ownerCutPct}% от аренды) — это плата за ваше спокойствие. В неё входит:
                        </p>
                        <ul className="text-[11px] text-muted-foreground space-y-1 leading-relaxed pl-1">
                          <li>🛡 <strong className="text-foreground">Гарантия выплаты</strong> — даже если арендатор пропадёт, деньги вы получите</li>
                          <li>💰 <strong className="text-foreground">Возмещение ущерба</strong> до {maxProt.toLocaleString("ru")} ₽ из фонда платформы</li>
                          <li>⚖️ <strong className="text-foreground">Решение споров</strong> — наши юристы на вашей стороне</li>
                          <li>📈 <strong className="text-foreground">Больше клиентов</strong> — арендаторы доверяют объявлениям с защитой</li>
                          <li>🧾 <strong className="text-foreground">Налоги и эквайринг</strong> — мы берём это на себя</li>
                        </ul>
                      </div>
                    )}

                    {/* Что видит арендатор */}
                    <div className="bg-white rounded-xl p-3 text-sm space-y-1.5 border border-border">
                      <p className="font-semibold text-foreground text-xs mb-1.5 uppercase tracking-wide text-muted-foreground">Что видит арендатор за 1 сутки</p>
                      <div className="flex justify-between text-muted-foreground text-xs"><span>Аренда</span><span>{rent.toLocaleString("ru")} ₽</span></div>
                      {formData.ownerProtectionEnabled && (
                        <div className="flex justify-between text-xs text-primary/80">
                          <span className="flex items-center gap-1">🛡 Гарантийный фонд</span>
                          <span>{combinedServiceFee.toLocaleString("ru", { maximumFractionDigits: 0 })} ₽</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold border-t border-border pt-1.5 text-xs text-foreground">
                        <span>Итого к оплате</span>
                        <span>{total.toLocaleString("ru", { maximumFractionDigits: 0 })} ₽</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {formData.ownerProtectionEnabled
                          ? `+ залог ${depositToShow.toLocaleString("ru")} ₽ (возвратный, удерживается платформой)`
                          : depositToShow > 0
                            ? `+ залог ${depositToShow.toLocaleString("ru")} ₽ (по договорённости, наличными)`
                            : "Залог по договорённости с владельцем"}
                      </p>
                      {!formData.ownerProtectionEnabled && (
                        <p className="text-[10px] text-slate-500 italic pt-1 border-t border-border">
                          💬 Доступ к вашим контактам арендатор покупает у платформы — так к вам обращаются только серьёзные люди
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ─── Поле залога + честные факты — для бесплатного объявления ─────── */}
            {!formData.ownerProtectionEnabled && (
              <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <HandCoins className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-sm text-slate-900">Залог по желанию</p>
                    <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
                      Можете попросить залог наличными при передаче вещи — это поможет защититься от повреждений.
                      Поле необязательное: оставьте пустым, если работаете без залога.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">Размер залога (₽), необязательно</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    className="input-field max-w-xs"
                    placeholder={formData.pricePerDay ? `Например, ${calcDeposit(Number(formData.pricePerDay)).toLocaleString("ru")}` : "Например, 3000"}
                    value={formData.manualDeposit}
                    onChange={e => setFormData({ ...formData, manualDeposit: e.target.value })}
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Если указываете — рекомендуем не меньше двух стоимостей суток.</p>
                </div>

                <div className="bg-white rounded-xl p-3 border border-slate-200">
                  <p className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-600" />
                    Как это работает (как на Авито)
                  </p>
                  <ul className="text-[11px] text-slate-700 space-y-1 leading-relaxed pl-1">
                    <li><span className="text-emerald-600 font-bold">✓</span> Объявление в каталоге, поиск, фото, чат, карта — <strong>бесплатно</strong></li>
                    <li><span className="text-emerald-600 font-bold">✓</span> Деньги от арендатора получаете <strong>лично, в полном объёме</strong></li>
                    <li><span className="text-emerald-600 font-bold">✓</span> Платформа берёт плату <strong>с арендатора</strong> за доступ к вашим контактам — спам-обращений нет</li>
                    <li><span className="text-slate-500">•</span> Сделку, расписку и передачу залога оформляете лично</li>
                    <li><span className="text-slate-500">•</span> Спорные ситуации решаете самостоятельно</li>
                  </ul>
                  <p className="text-[11px] text-slate-700 mt-2 pt-2 border-t border-slate-200">
                    💡 <strong>Хотите эскроу, страховку и помощь в спорах?</strong> Переключите формат на «🛡 Защищённую сделку» выше — за {21}% от аренды платформа берёт всё на себя.
                  </p>
                </div>
              </div>
            )}
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
