import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="page-scroll w-full flex items-center justify-center bg-gray-50 safe-area-top safe-area-bottom">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Página não encontrada</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Parece que a rota não foi configurada.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
