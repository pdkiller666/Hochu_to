import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  setAuthTokenGetter,
  setAuthTokenRefresher,
  setUnauthorizedHandler,
} from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { RegionProvider } from "@/lib/region-context";
import { FavoritesProvider } from "@/lib/favorites-context";
import { getToken, refreshAccessToken, logoutEverywhere } from "@/lib/auth";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import Catalog from "@/pages/Catalog";
import ListingDetail from "@/pages/ListingDetail";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import ListingForm from "@/pages/ListingForm";
import OwnerProfile from "@/pages/OwnerProfile";
import JointPurchases from "@/pages/JointPurchases";
import Instructions from "@/pages/Instructions";
import About from "@/pages/About";
import Contacts from "@/pages/Contacts";
import Privacy from "@/pages/Privacy";
import Favorites from "@/pages/Favorites";
import AdminPage from "@/pages/AdminPage";
import BetaBanner from "@/components/BetaBanner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);
  return null;
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <Switch>
      <Route path="/" component={Home} />
      <Route path="/catalog" component={Catalog} />
      <Route path="/listings/:id" component={ListingDetail} />
      <Route path="/users/:id" component={OwnerProfile} />
      <Route path="/auth" component={Auth} />
      <Route path="/favorites" component={Favorites} />

      {/* Protected Routes inside components */}
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/dashboard/listings/new" component={ListingForm} />
      <Route path="/dashboard/listings/:id/edit" component={ListingForm} />

      <Route path="/joint-purchases" component={JointPurchases} />
      <Route path="/how-to-rent" component={Instructions} />
      <Route path="/how-to-list" component={Instructions} />
      <Route path="/guarantee-fund" component={Instructions} />

      <Route path="/admin" component={AdminPage} />

      <Route path="/about" component={About} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/privacy" component={Privacy} />

      <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    setAuthTokenRefresher(() => refreshAccessToken());
    setUnauthorizedHandler(async () => {
      await logoutEverywhere();
      // Перенаправляем на страницу входа только с защищённых маршрутов.
      // Каталог, карточки товаров и публичные страницы доступны без авторизации.
      const PUBLIC_PATHS = ["/", "/catalog", "/listings", "/users", "/about", "/contacts", "/privacy", "/how-to-rent", "/how-to-list", "/guarantee-fund", "/joint-purchases"];
      const path = window.location.pathname;
      const isPublic = PUBLIC_PATHS.some(p => path === p || path.startsWith(p + "/"));
      if (!isPublic && !path.startsWith("/auth")) {
        window.location.assign("/auth?tab=login");
      }
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RegionProvider>
        <FavoritesProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <BetaBanner />
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </FavoritesProvider>
      </RegionProvider>
    </QueryClientProvider>
  );
}

export default App;
