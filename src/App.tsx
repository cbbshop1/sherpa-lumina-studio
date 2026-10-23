import { Toaster } from "@/components/ui/toaster";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import PitchPipe from "./pages/PitchPipe";
import NotFound from "./pages/NotFound";
import { StudioSessionProvider } from "./context/StudioSession";

const queryClient = new QueryClient();
const Studio = lazy(() => import("./pages/Studio"));

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <StudioSessionProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/piano" element={<Index />} />
            <Route path="/chords" element={<Index />} />
            <Route path="/scales" element={<Index />} />
            <Route path="/progressions" element={<Index />} />
            <Route path="/pitch-pipe" element={<PitchPipe />} />
            <Route
              path="/studio"
              element={
                <Suspense
                  fallback={
                    <div className="p-12 text-muted-foreground">
                      Opening Studio...
                    </div>
                  }
                >
                  <Studio />
                </Suspense>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </StudioSessionProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
