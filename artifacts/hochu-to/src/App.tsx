import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  setAuthTokenGetter,
  setAuthTokenRefresher,
  setUnauthorizedHandler,
} from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useRef } from "react";
import { RegionProvider, setCachedGeoRegion, getCachedGeoRegion, detectRegionByServerGeoIP } from "@/lib/region-context";
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

function AppWithGeo() {
  const geoInitialized = useRef(false);

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    setAuthTokenRefresher(() => refreshAccessToken());
    setUnauthorizedHandler(async () => {
      await logoutEverywhere();
      if (!window.location.pathname.startsWith("/auth")) {
        window.location.assign("/auth?tab=login");
      }
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  useEffect(() => {
    if (geoInitialized.current || getCachedGeoRegion()) return;
    geoInitialized.current = true;

    const initializeGeo = async () => {
      try {
        const regionsRes = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/regions?select=id,slug,name&limit=100`,
          { headers: { "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY } }
        );
        const regionsData = await regionsRes.json();
        if (Array.isArray(regionsData)) {
          const slug = await detectRegionByServerGeoIP(regionsData);
          if (slug) setCachedGeoRegion(slug);
        }
      } catch {}
    };

    initializeGeo();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RegionProvider>
        <FavoritesProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </FavoritesProvider>
      </RegionProvider>
    </QueryClientProvider>
  );
}

function App() {
  return <AppWithGeo />;
}

export default App;
