"use client";
import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createClient } from "../../utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Loader2 } from "lucide-react"; // Added Loader2 for loading state

// NOTE: Use the Polygon API key, ensuring it's accessible client-side (NEXT_PUBLIC_)
const POLYGON_API_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY;

// ==============================================================================
// 1. POLYGON API FUNCTIONS (Free Tier Compatible)
// ==============================================================================

/**
 * Checks if a ticker exists using Polygon's Ticker Details endpoint and fetches the company name.
 * @param ticker - The stock ticker symbol.
 * @returns An object containing the validity and the company name.
 */
async function checkTickerAndName(ticker: string): Promise<{ exists: boolean; name: string | null }> {
  if (!ticker || !POLYGON_API_KEY) return { exists: false, name: null };
  try {
    // Ticker Details endpoint is a reliable way to check for ticker existence on the free tier.
    const response = await fetch(
      `https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${POLYGON_API_KEY}`
    );
    const data = await response.json();
    
    // Check if the status is OK and if results contains the ticker
    if (data.status === "OK" && data.results && data.results.ticker === ticker.toUpperCase()) {
      return { 
        exists: true, 
        name: data.results.name || ticker.toUpperCase() 
      };
    }
    
    return { exists: false, name: null };
    
  } catch (error) {
    console.error("Ticker validation error:", error);
    // Treat network error as non-existent or failed check
    return { exists: false, name: null }; 
  }
}

/**
 * Fetches the EUR to USD exchange rate using Polygon's Previous Close aggregates for currency pairs.
 */
async function fetchEuroToUsdRate(): Promise<number> {
  if (!POLYGON_API_KEY) return 1.08;
  try {
    // Polygon currency ticker format: C:{FROM}{TO}
    const currencyTicker = `C:EURUSD`; 
    
    const response = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${currencyTicker}/prev?adjusted=true&apiKey=${POLYGON_API_KEY}`
    );
    const data = await response.json();

    if (data.status === "OK" && data.results && data.results.length > 0) {
      // 'c' is the close rate
      const closeRate = data.results[0].c;
      return typeof closeRate === "number" ? closeRate : 1.08;
    }
  } catch (error) {
    console.error("Exchange rate fetch error:", error);
  }
  // Fallback rate to prevent form failure
  return 1.08; 
}


// ==============================================================================
// 2. ZOD SCHEMA AND FORM
// ==============================================================================

// Update Zod schema to prevent submission if validation hasn't passed
const formSchema = z.object({
  ticker: z.string().min(1, { message: "Ticker is required." }).toUpperCase(),
  quantity: z.number().min(1, { message: "Must be at least 1 share." }),
  purchase_price: z.number().min(0.01, { message: "Must be a valid price." }),
  purchase_date: z.string().min(1, { message: "Date is required." }),
  purchase_currency: z.enum(["USD", "EUR"]),
});


export function AddStockForm({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [tickerValidated, setTickerValidated] = useState<boolean | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const supabase = createClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ticker: "",
      quantity: 1,
      purchase_price: 100.00,
      purchase_date: new Date().toISOString().substring(0, 10),
      purchase_currency: "USD",
    },
  });
  
  const tickerValue = form.watch("ticker");
  
  // New function for manual or debounced check
  const performTickerCheck = useCallback(async (ticker: string) => {
    if (!ticker) {
      setTickerValidated(null);
      setCompanyName(null);
      form.clearErrors("ticker");
      return;
    }

    setIsChecking(true);
    const { exists, name } = await checkTickerAndName(ticker);
    setIsChecking(false);
    
    setTickerValidated(exists);
    setCompanyName(exists ? name : null);

    if (!exists) {
        form.setError("ticker", { type: "manual", message: "Ticker symbol not found or invalid." });
    } else {
        form.clearErrors("ticker");
    }
    return exists;
  }, [form]);


  // Debounced Ticker Check (Passive Check)
  useEffect(() => {
    if (tickerValue.length > 0) {
      const timeout = setTimeout(() => {
        performTickerCheck(tickerValue);
      }, 1000); // 1 second delay for passive check
      return () => clearTimeout(timeout);
    } else {
        performTickerCheck(""); // Clear state
    }
  }, [tickerValue, performTickerCheck]);

  
  // Ticker Check Button Handler (Active Check)
  const handleCheckClick = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent form submission
    const ticker = form.getValues("ticker");
    if (!ticker) {
        form.setError("ticker", { type: "manual", message: "Please enter a ticker first." });
        return;
    }
    await performTickerCheck(ticker);
  };


  async function onSubmit(values: z.infer<typeof formSchema>) {
    
    if (!tickerValidated) {
        alert("Please validate the ticker before submitting.");
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      alert("You must be logged in to add a stock.");
      return;
    }

    let usdPrice = values.purchase_price;

    // 1. Convert EUR to USD if needed
    if (values.purchase_currency === "EUR") {
      const euroToUsdRate = await fetchEuroToUsdRate();
      usdPrice = values.purchase_price * euroToUsdRate; 
    }

    // 2. Insert data into Supabase
    const { error } = await supabase
      .from("portfolios")
      .insert({
        user_id: user.id,
        ticker: values.ticker,
        quantity: values.quantity,
        purchase_price: usdPrice, // Store the USD value
        purchase_date: values.purchase_date,
      });

    if (error) {
      console.error("Error adding stock:", error);
      alert(`Error: ${error.message}`);
    } else {
      form.reset();
      setCompanyName(null);
      setTickerValidated(null);
      setOpen(false); // Close the dialog
      onSuccess(); // Notify the parent component to refresh the portfolio
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>+ Add Stock</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Stock Holding</DialogTitle>
          <DialogDescription>
            Enter the details of a stock you own. All prices are converted to USD for storage.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Ticker Field with Validation Indicator/Button */}
            <FormField
              control={form.control}
              name="ticker"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ticker Symbol</FormLabel>
                  <FormControl>
                    <div className="flex items-center space-x-2">
                        <div className="relative flex-grow">
                            <Input placeholder="e.g., AAPL" {...field} />
                            {/* Validation Icon (Passive) */}
                            {tickerValidated !== null && !isChecking && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    {tickerValidated ? (
                                        <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <X className="h-4 w-4 text-red-500" />
                                    )}
                                </div>
                            )}
                        </div>
                        {/* Check Button (Active) */}
                        <Button 
                            type="button" 
                            variant="outline" 
                            size="icon" 
                            onClick={handleCheckClick}
                            disabled={isChecking}
                        >
                            {isChecking ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Check className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                  {/* Company Name Display */}
                  {companyName && (
                    <p className="text-sm text-green-600 font-medium">
                        Ticker Verified: {companyName}
                    </p>
                  )}
                </FormItem>
              )}
            />

            {/* Quantity Field */}
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input 
                        type="number" 
                        step="1" 
                        {...field} 
                        onChange={e => field.onChange(parseFloat(e.target.value))} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Purchase Price and Currency Fields (side-by-side) */}
            <div className="flex space-x-4">
                <div className="flex-grow">
                    <FormField
                        control={form.control}
                        name="purchase_price"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Purchase Price</FormLabel>
                                <FormControl>
                                    <Input 
                                        type="number" 
                                        step="0.01" 
                                        {...field} 
                                        onChange={e => field.onChange(parseFloat(e.target.value))} 
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <div>
                    <FormField
                        control={form.control}
                        name="purchase_currency"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Currency</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="w-[100px]">
                                            <SelectValue placeholder="USD" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="USD">USD ($)</SelectItem>
                                        <SelectItem value="EUR">EUR (€)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
            </div>


            {/* Purchase Date Field */}
            <FormField
              control={form.control}
              name="purchase_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
                type="submit" 
                disabled={form.formState.isSubmitting || !tickerValidated || isChecking}
            >
              {form.formState.isSubmitting ? "Adding..." : "Add Holding"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}