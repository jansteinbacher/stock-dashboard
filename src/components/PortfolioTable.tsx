"use client";
import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "../../utils/supabase/client";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AddStockForm } from "./AddStockFrom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Define your Polygon API key here
// NOTE: For a production app, you should store this in environment variables.
// Ensure you have this set in your Next.js environment variables (e.g., .env.local)
const POLYGON_API_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY!; // Use NEXT_PUBLIC_ for client-side access

interface PortfolioItem {
  id: string;
  ticker: string;
  quantity: number;
  purchase_price: number;
  purchase_date: string;
}

interface DisplayItem extends PortfolioItem {
  current_price: number;
  market_value: number;
  cost_basis: number;
  gain_loss: number;
  gain_loss_percent: number;
}

// ==============================================================================
// 1. POLYGON API FETCH FUNCTIONS (Free Tier Compatible)
// ==============================================================================

// Function to fetch previous day's close stock data from Polygon (Free Tier)
const fetchStockPrices = async (tickers: string[]): Promise<Record<string, number>> => {
  if (!POLYGON_API_KEY) {
    console.error("POLYGON_API_KEY is not set.");
    return Object.fromEntries(tickers.map(ticker => [ticker, 0]));
  }

  const prices: Record<string, number> = {};
  for (const ticker of tickers) {
    try {
      // Polygon free tier has a rate limit (5 requests per minute),
      // we'll use a small delay and fetch previous day's close.
      await new Promise(resolve => setTimeout(resolve, 150)); // Small delay for rate limit management

      // Use the Previous Close aggregate endpoint (available on Free Tier)
      const response = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${POLYGON_API_KEY}`
      );
      const data = await response.json();

      if (data && data.results && data.results.length > 0) {
        // 'c' is the close price of the last market day
        const closePrice = data.results[0].c;
        prices[ticker] = typeof closePrice === "number" ? closePrice : 0;
      } else {
        // Log errors/messages from the API if ticker not found
        console.warn(`Could not find price for ${ticker}. Polygon API response:`, data);
        prices[ticker] = 0;
      }
    } catch (error) {
      console.error(`Fetch error for ${ticker}:`, error);
      prices[ticker] = 0;
    }
  }
  return prices;
};

// Function to fetch currency exchange rate (Previous Close) from Polygon (Free Tier)
const fetchExchangeRate = async (from: string, to: string): Promise<number> => {
  if (from === to) return 1.0;
  if (!POLYGON_API_KEY) return 1.0;

  try {
    // Polygon free tier requires the currency pair as a ticker, e.g., C:USDEUR
    const currencyTicker = `C:${from}${to}`;
    
    // Use the Previous Close aggregate endpoint for currency pairs
    const response = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${currencyTicker}/prev?adjusted=true&apiKey=${POLYGON_API_KEY}`
    );
    const data = await response.json();

    if (data && data.results && data.results.length > 0) {
      // 'c' is the close rate
      const closeRate = data.results[0].c;
      return typeof closeRate === "number" ? closeRate : 1.0;
    }
    
    console.warn(`Error fetching exchange rate ${from}/${to}:`, data);
    return 1.0;
  } catch (error) {
    console.error("Fetch error for exchange rate:", error);
    return 1.0;
  }
};

// ==============================================================================
// 2. SUPABASE CRUD FUNCTIONS (Unchanged)
// ==============================================================================
async function deleteHolding(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("portfolios")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Delete Error:", error);
    alert("Could not delete holding.");
    return false;
  }
  return true;
}

function EditHoldingForm({ holding, onClose, onSuccess }: { holding: PortfolioItem, onClose: () => void, onSuccess: () => void }) {
  const [data, setData] = useState({
    quantity: holding.quantity,
    purchase_price: holding.purchase_price,
    purchase_date: holding.purchase_date,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClient();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await supabase
      .from("portfolios")
      .update({
        quantity: data.quantity,
        purchase_price: data.purchase_price,
        purchase_date: data.purchase_date,
      })
      .eq("id", holding.id);

    setIsSubmitting(false);
    if (error) {
      console.error("Update Error:", error);
      alert("Could not update holding.");
    } else {
      onSuccess();
      onClose();
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 py-4">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="ticker" className="text-right">Ticker</Label>
        <Input id="ticker" value={holding.ticker} disabled className="col-span-3" />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="quantity" className="text-right">Quantity</Label>
        <Input
          id="quantity"
          type="number"
          step="1"
          value={data.quantity}
          onChange={(e) => setData({ ...data, quantity: parseFloat(e.target.value) || 0 })}
          className="col-span-3"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="price" className="text-right">Price</Label>
        <Input
          id="price"
          type="number"
          step="0.01"
          // Note: The displayed price is the raw USD price stored in Supabase.
          value={data.purchase_price} 
          onChange={(e) => setData({ ...data, purchase_price: parseFloat(e.target.value) || 0 })}
          className="col-span-3"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="date" className="text-right">Date</Label>
        <Input
          id="date"
          type="date"
          value={data.purchase_date}
          onChange={(e) => setData({ ...data, purchase_date: e.target.value })}
          className="col-span-3"
        />
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
}

// ==============================================================================
// 3. MAIN PORTFOLIO TABLE COMPONENT (Updated Currency List)
// ==============================================================================
export function PortfolioTable() {
  const [holdings, setHoldings] = useState<DisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<PortfolioItem | null>(null);
  // Polygon free tier only supports a few major pairs. We'll limit the options.
  const supportedCurrencies = ["USD", "EUR", "GBP"]; 
  const [currency, setCurrency] = useState<string>("USD");
  const [exchangeRate, setExchangeRate] = useState<number>(1.0);
  const supabase = createClient();

  // ... (fetchPortfolio is unchanged but calls the new fetch functions)
  const fetchPortfolio = useCallback(async () => {
    setLoading(true);

    // 1. Fetch user's holdings from Supabase
    const { data: holdingsData, error } = await supabase
      .from("portfolios")
      .select("id, ticker, quantity, purchase_price, purchase_date")
      .order("ticker", { ascending: true });

    if (error) {
      console.error("Error fetching portfolio:", error);
      setLoading(false);
      return;
    }

    const portfolio: PortfolioItem[] = holdingsData || [];

    if (portfolio.length === 0) {
      setHoldings([]);
      setLoading(false);
      return;
    }

    // 2. Extract unique tickers and fetch real-time prices
    const uniqueTickers = Array.from(new Set(portfolio.map(h => h.ticker)));

    // Correctly call the local function directly
    const prices = await fetchStockPrices(uniqueTickers);

    // 3. Combine data and calculate metrics
    const displayHoldings: DisplayItem[] = portfolio.map(item => {
      const currentPrice = prices[item.ticker] || 0;
      const costBasis = item.quantity * item.purchase_price;
      const marketValue = item.quantity * currentPrice;
      const gainLoss = marketValue - costBasis;

      return {
        ...item,
        current_price: currentPrice,
        cost_basis: costBasis,
        market_value: marketValue,
        // Ensure costBasis is not zero before dividing
        gain_loss: gainLoss,
        gain_loss_percent: costBasis === 0 ? 0 : (gainLoss / costBasis) * 100,
      };
    });

    setHoldings(displayHoldings);
    setLoading(false);
  }, [supabase]);


  // Fetch exchange rate when the currency changes
  const handleCurrencyChange = useCallback(async (newCurrency: string) => {
    setCurrency(newCurrency);
    if (newCurrency === "USD") {
      setExchangeRate(1.0);
    } else {
      // Stock purchase prices are stored in USD. We convert the USD market value
      // and cost basis into the target currency. Hence, we fetch USD to NewCurrency rate.
      const rate = await fetchExchangeRate("USD", newCurrency); 
      setExchangeRate(rate);
    }
  }, []);

  // Fetch data on component mount and when currency or holdings change
  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  // Handle delete and edit actions
  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this holding?")) {
      const success = await deleteHolding(id);
      if (success) {
        fetchPortfolio(); // Refresh the table
      }
    }
  };

  const handleEdit = (holding: PortfolioItem) => {
    setEditingHolding(holding);
    setIsEditDialogOpen(true);
  };

  // Calculate overall metrics (applying exchange rate)
  const totalMarketValue = holdings.reduce((sum, item) => sum + item.market_value, 0) * exchangeRate;
  const totalCostBasis = holdings.reduce((sum, item) => sum + item.cost_basis, 0) * exchangeRate;
  const totalGainLoss = totalMarketValue - totalCostBasis;
  const totalGainLossPercent = totalCostBasis === 0 ? 0 : (totalGainLoss / totalCostBasis) * 100;

  // Helper function for formatting currency
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 2
    }).format(value);
  const formatPercent = (value: number) => value.toFixed(2) + '%';
  const getChangeColor = (value: number) => value > 0 ? "text-green-500" : value < 0 ? "text-red-500" : "text-gray-500";


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Investment Portfolio</h1>
        <div className="flex space-x-2">
          <select
            value={currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className="p-2 border rounded-md"
          >
            {supportedCurrencies.map(c => (
                <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <AddStockForm onSuccess={fetchPortfolio} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Portfolio Summary ({currency})</CardTitle>
          <CardDescription>Valuation based on **Previous Market Close** prices from Polygon.io.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm font-medium">Total Value</p>
            <p className="text-2xl font-semibold">{formatCurrency(totalMarketValue)}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Total Gain/Loss</p>
            <p className={`text-2xl font-semibold ${getChangeColor(totalGainLoss)}`}>{formatCurrency(totalGainLoss)}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Total Return (%)</p>
            <p className={`text-2xl font-semibold ${getChangeColor(totalGainLossPercent)}`}>{formatPercent(totalGainLossPercent)}</p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Holding</DialogTitle>
            <DialogDescription>
              Make changes to your stock holding details (Price is in USD).
            </DialogDescription>
          </DialogHeader>
          {editingHolding && (
            <EditHoldingForm
              holding={editingHolding}
              onClose={() => setIsEditDialogOpen(false)}
              onSuccess={fetchPortfolio}
            />
          )}
        </DialogContent>
      </Dialog>

      {loading ? (
        <p>Loading portfolio data...</p>
      ) : holdings.length === 0 ? (
        <p className="text-center text-gray-500">Your portfolio is empty. Add a stock to get started! 🚀</p>
      ) : (
        <Table className="border rounded-lg">
          <TableCaption>A list of your current stock holdings.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Cost/Share ({currency})</TableHead>
              <TableHead>Current Price ({currency})</TableHead>
              <TableHead>Market Value ({currency})</TableHead>
              <TableHead className="text-right">Gain/Loss</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.map((holding) => (
              <TableRow key={holding.id}>
                <TableCell className="font-medium">{holding.ticker}</TableCell>
                <TableCell>{holding.quantity}</TableCell>
                <TableCell>{formatCurrency(holding.purchase_price * exchangeRate)}</TableCell>
                <TableCell>{formatCurrency(holding.current_price * exchangeRate)}</TableCell>
                <TableCell className="font-semibold">{formatCurrency(holding.market_value * exchangeRate)}</TableCell>
                <TableCell className={`text-right ${getChangeColor(holding.gain_loss)}`}>
                  {formatCurrency(holding.gain_loss * exchangeRate)} ({formatPercent(holding.gain_loss_percent)})
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleEdit(holding)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleDelete(holding.id)} className="text-red-500">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}