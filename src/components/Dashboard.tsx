/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import React, { useContext, useEffect, useState, useMemo, useRef, lazy, Suspense } from "react";
import {
  collection,
  CollectionReference,
  DocumentData,
  getDocs,
  query,
  where,
  Timestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useRouter } from "next/navigation";
import { motion, easeInOut } from "framer-motion";
import { FaShoppingCart, FaBox, FaArrowDown, FaGift, FaGlobe, FaFilter, FaMoneyBillWave } from "react-icons/fa";
import Loader from "@/components/Loader";
import { CounterContext } from "@/lib/CounterContext";
import {
  Chart as ChartJS,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  LinearScale,
  CategoryScale,
  ChartData,
  ChartOptions,
  TooltipItem,
} from "chart.js";
import dynamic from "next/dynamic";

// Lazy load chart components
const Doughnut = lazy(() => import("react-chartjs-2").then((mod) => ({ default: mod.Doughnut })));
const ApexChart = lazy(() => import("react-apexcharts"));

ChartJS.register(ArcElement, Title, Tooltip, Legend, LinearScale, CategoryScale);

// Cache storage
interface CacheEntry {
  data: {
    totalSpecialOrdersToday: number;
    totalSaleBillToday: number;
    totalProducts: number;
    totalOrderAmount: number;
    paymentModeData1: { cash: number; card: number; upi: number };
    orders: { oaNo: string; custName: string; netAmount: number; payMode: string; oaDate: Timestamp }[];
    splOrders: { billNo: string; custName: string; amount: number; flavor: string; billDate: Timestamp; status: string }[];
    sGroupQuantities: { sGroupDesc: string; quantity: number }[];
    productQuantities: { prodName: string; quantity: number }[];
  };
  timestamp: number;
}

const cache: { [key: string]: CacheEntry } = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

const cardColors = [
  { color: "text-[#FFA500]", border: "border-[#FFA500]" }, // Orange
  { color: "text-[#A855F7]", border: "border-[#A855F7]" }, // Purple
  { color: "text-[#22C55E]", border: "border-[#22C55E]" }, // Green-500
  { color: "text-[#FF69B4]", border: "border-[#FF69B4]" }, // Pink
  { color: "text-[#3B82F6]", border: "border-[#3B82F6]" }, // Blue
];

const Dashboard = () => {
  const router = useRouter();
  const { state } = useContext(CounterContext);
  const [totalSpecialOrdersToday, setTotalSpecialOrdersToday] = useState<number>(0);
  const [totalSaleBillToday, setTotalSaleBillToday] = useState<number>(0);
  const [totalProducts, setTotalProducts] = useState<number>(0);
  const [totalOrderAmount, setTotalOrderAmount] = useState<number>(0);
  const [company, setCompany] = useState<any>(null);
  const [paymentModeData1, setPaymentModeData1] = useState<{ cash: number; card: number; upi: number }>({
    cash: 0,
    card: 0,
    upi: 0,
  });
  const [paymentModeData2] = useState<{ cash: number; card: number; upi: number }>({
    cash: 12000,
    card: 18000,
    upi: 16000,
  });
  const [orders, setOrders] = useState<
    { oaNo: string; custName: string; netAmount: number; payMode: string; oaDate: Timestamp }[]
  >([]);
  const [splOrders, setSplOrders] = useState<
    { billNo: string; custName: string; amount: number; flavor: string; billDate: Timestamp; status: string }[]
  >([]);
  const [sGroupQuantities, setSGroupQuantities] = useState<{ sGroupDesc: string; quantity: number }[]>([]);
  const [productQuantities, setProductQuantities] = useState<{ prodName: string; quantity: number }[]>([]);
  const [showAllOrders, setShowAllOrders] = useState<boolean>(false);
  const [showAllSplOrders, setShowAllSplOrders] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [calendarType, setCalendarType] = useState<string>("Gregorian"); // Default to Gregorian
  const chartRef = useRef<any>(null);
  const [filterType, setFilterType] = useState<"today" | "month" | "year" | "custom">("today");
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
  const currency = state.currency;

  // Generate cache key based on tenantId and filter parameters
  const getCacheKey = () => {
    return `${state.tenantId}-${filterType}-${selectedMonth}-${selectedYear}-${startDate}-${endDate}`;
  };

  // Nepali calendar conversion logic (simplified)
  const toNepaliDate = (date: Date): string => {
    // Approximate Bikram Sambat conversion: add 56 years and 8 months
    const nepaliYear = date.getFullYear() + 56;
    const nepaliMonth = (date.getMonth() + 8) % 12 || 12;
    const nepaliDay = date.getDate();
    const nepaliHours = date.getHours();
    const nepaliMinutes = date.getMinutes();
    const nepaliSeconds = date.getSeconds();
    const ampm = nepaliHours >= 12 ? "PM" : "AM";
    const hours12 = nepaliHours % 12 || 12;

    // Nepali month names
    const nepaliMonths = [
      "Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
      "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"
    ];
    const nepaliWeekdays = [
      "Aitabar", "Sombar", "Mangalbar", "Budhbar", "Bihibar", "Sukrabar", "Sanibar"
    ];

    const nepaliDateString = `${
      nepaliWeekdays[date.getDay()]
    }, ${nepaliDay} ${nepaliMonths[nepaliMonth - 1]} ${nepaliYear}, ${hours12}:${nepaliMinutes
      .toString()
      .padStart(2, "0")}:${nepaliSeconds.toString().padStart(2, "0")} ${ampm}`;

    return nepaliDateString;
  };

  // Fetch calendar type from Firestore
  const fetchCalendarType = async () => {
    try {
      const calendarRef = doc(db, "TenantsDb", state.tenantId,"SETTINGS", "Calendar");
      const calendarDoc = await getDoc(calendarRef);
      if (calendarDoc.exists()) {
        const data = calendarDoc.data();
        setCalendarType(data.calendartype || "Gregorian");
      } else {
        setCalendarType("Gregorian"); // Default if no document found
      }
    } catch (error) {
      console.error("Error fetching calendar type:", error);
      setCalendarType("Gregorian"); // Fallback to Gregorian on error
    }
  };

  useEffect(() => {
    fetchCalendarType();
  }, [state.tenantId]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      if (calendarType === "Bikram Sambat") {
        setCurrentTime(toNepaliDate(now));
      } else {
        const options: Intl.DateTimeFormatOptions = {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata",
        };
        const formattedTime = now
          .toLocaleString("en-US", options)
          .replace(/, (\d{1,2})/, ", $1")
          .replace(/(\w+), (\d{1,2}) (\w+) (\d{4}),/, "$1, $2 $3 $4,")
          .replace(/,(\d{02}:\d{02}:\d{02} [AP]M)/, ", $1");
        setCurrentTime(formattedTime);
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [calendarType]);

  useEffect(() => {
    const storedCompany = localStorage.getItem("company");
    if (storedCompany) {
      setCompany(JSON.parse(storedCompany));
    }
  }, []);

  // Fetch data with caching
  const fetchData = async () => {
    const cacheKey = getCacheKey();
    const now = Date.now();
    const cached = cache[cacheKey];

    // Check if cache is valid
    if (cached && now - cached.timestamp < CACHE_DURATION) {
      setTotalSpecialOrdersToday(cached.data.totalSpecialOrdersToday);
      setTotalSaleBillToday(cached.data.totalSaleBillToday);
      setTotalProducts(cached.data.totalProducts);
      setTotalOrderAmount(cached.data.totalOrderAmount);
      setPaymentModeData1(cached.data.paymentModeData1);
      setOrders(cached.data.orders);
      setSplOrders(cached.data.splOrders);
      setSGroupQuantities(cached.data.sGroupQuantities);
      setProductQuantities(cached.data.productQuantities);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let start: Date, end: Date;

      if (filterType === "today") {
        start = new Date();
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(start.getDate() + 1);
      } else if (filterType === "month") {
        start = new Date(`${selectedMonth}-01`);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setMonth(start.getMonth() + 1);
      } else if (filterType === "year") {
        start = new Date(`${selectedYear}-01-01`);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setFullYear(start.getFullYear() + 1);
      } else if (filterType === "custom" && startDate && endDate) {
        start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
      } else {
        setLoading(false);
        return;
      }

      const splOrdersRef = collection(db, "TenantsDb", state.tenantId, "SPLORDER") as CollectionReference<DocumentData>;
      const splOrdersQuery = query(
        splOrdersRef,
        where("BILL_DATE", ">=", Timestamp.fromDate(start)),
        where("BILL_DATE", "<=", Timestamp.fromDate(end))
      );
      const splOrdersSnapshot = await getDocs(splOrdersQuery);
      const totalSpecialOrdersToday = splOrdersSnapshot.docs.length;

      const splOrderData = splOrdersSnapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            billNo: data.BILL_NO || "N/A",
            custName: data.CUSTNAME || "Unknown",
            amount: parseFloat(data.AMOUNT || "0"),
            flavor: data.CFLAVOR || "N/A",
            billDate: data.BILL_DATE || Timestamp.fromDate(new Date()),
            status: data.STATUS || "PENDING",
          };
        })
        .filter((order) => order.status !== "")
        .sort((a, b) => b.billDate.toDate().getTime() - a.billDate.toDate().getTime());

      const productsRef = collection(db, "TenantsDb", state.tenantId, "Products") as CollectionReference<DocumentData>;
      const productQuery = query(productsRef, where("AVAILABLE", "==", true));
      const productSnapshot = await getDocs(productQuery);
      const totalProducts = productSnapshot.docs.length;

      const ordersRef = collection(db, "TenantsDb", state.tenantId, "ORDER") as CollectionReference<DocumentData>;
      const ordersQuery = query(
        ordersRef,
        where("OA_DATE", ">=", Timestamp.fromDate(start)),
        where("OA_DATE", "<=", Timestamp.fromDate(end))
      );
      const orderSnapshot = await getDocs(ordersQuery);
      let orderAmount = 0;
      const orderData = orderSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          oaNo: data.OA_NO || "N/A",
          custName: data.CUSTNAME || "Unknown",
          netAmount: parseFloat(data.NET_AMOUNT || "0"),
          payMode: data.PAY_MODE || "N/A",
          oaDate: data.OA_DATE || Timestamp.fromDate(new Date()),
        };
      });
      const paymentModeSums = { cash: 0, card: 0, upi: 0 };
      orderSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const netAmount = parseFloat(data.NET_AMOUNT || "0");
        orderAmount += netAmount;
        const payMode = (data.PAY_MODE || "N/A").toLowerCase();
        if (payMode.includes("cash")) paymentModeSums.cash += netAmount;
        else if (payMode.includes("card")) paymentModeSums.card += netAmount;
        else if (payMode.includes("upi")) paymentModeSums.upi += netAmount;
      });

      const billsRef = collection(db, "TenantsDb", state.tenantId, "BILL") as CollectionReference<DocumentData>;
      const billsQuery = query(
        billsRef,
        where("BILL_DATE", ">=", Timestamp.fromDate(start)),
        where("BILL_DATE", "<=", Timestamp.fromDate(end))
      );
      const billSnapshot = await getDocs(billsQuery);
      let billAmount = 0;
      billSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        let netAmount = parseFloat(data.NET_AMOUNT || "0");
        if (netAmount === 0 && data.BASIC && data.PROMO_DISCOUNT !== undefined) {
          netAmount = parseFloat(data.BASIC || "0") + (data.GST_AMOUNT || 0) - (data.PROMO_DISCOUNT || 0);
        }
        billAmount += netAmount;
        const payMode = (data.PAY_MODE || "N/A").toLowerCase();
        if (payMode.includes("cash")) paymentModeSums.cash += netAmount;
        else if (payMode.includes("card")) paymentModeSums.card += netAmount;
        else if (payMode.includes("upi")) paymentModeSums.upi += netAmount;
      });

      const paymentModeData1 = {
        cash: paymentModeSums.cash,
        card: paymentModeSums.card,
        upi: paymentModeSums.upi,
      };

      const totalSaleBillToday = orderSnapshot.docs.length + billSnapshot.docs.length;
      const totalOrderAmount = orderAmount + billAmount;
      const ordersSorted = orderData.sort((a, b) => b.oaDate.toDate().getTime() - a.oaDate.toDate().getTime());

      const orderDetRef = collection(db, "TenantsDb", state.tenantId, "ORDERDET") as CollectionReference<DocumentData>;
      const orderDetQuery = query(
        orderDetRef,
        where("OA_DATE", ">=", Timestamp.fromDate(start)),
        where("OA_DATE", "<=", Timestamp.fromDate(end))
      );
      const orderDetSnapshot = await getDocs(orderDetQuery);

      const billDetRef = collection(db, "TenantsDb", state.tenantId, "BILLDET") as CollectionReference<DocumentData>;
      const billDetQuery = query(
        billDetRef,
        where("BILL_DATE", ">=", Timestamp.fromDate(start)),
        where("BILL_DATE", "<=", Timestamp.fromDate(end))
      );
      const billDetSnapshot = await getDocs(billDetQuery);

      const productQuantitiesMap = new Map<string, { prodName: string; quantity: number }>();
      const sGroupQuantitiesMap = new Map<string, { sGroupDesc: string; quantity: number }>();

      orderDetSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const prodName = data.PRODNAME || "Unknown";
        const sGroupDesc = data.SGroupDesc || "Unknown";
        const quantity = data.QUANTITY || 0;
        const currentProd = productQuantitiesMap.get(prodName) || { prodName, quantity: 0 };
        currentProd.quantity += quantity;
        productQuantitiesMap.set(prodName, currentProd);
        const currentSGroup = sGroupQuantitiesMap.get(sGroupDesc) || { sGroupDesc, quantity: 0 };
        currentSGroup.quantity += quantity;
        sGroupQuantitiesMap.set(sGroupDesc, currentSGroup);
      });

      billDetSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const prodName = data.PRODNAME || "Unknown";
        const sGroupDesc = data.SGroupDesc || "Unknown";
        const quantity = data.QUANTITY || 0;
        const currentProd = productQuantitiesMap.get(prodName) || { prodName, quantity: 0 };
        currentProd.quantity += quantity;
        productQuantitiesMap.set(prodName, currentProd);
        const currentSGroup = sGroupQuantitiesMap.get(sGroupDesc) || { sGroupDesc, quantity: 0 };
        currentSGroup.quantity += quantity;
        sGroupQuantitiesMap.set(sGroupDesc, currentSGroup);
      });

      const productQuantities = Array.from(productQuantitiesMap.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);
      const sGroupQuantities = Array.from(sGroupQuantitiesMap.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      setTotalSpecialOrdersToday(totalSpecialOrdersToday);
      setTotalSaleBillToday(totalSaleBillToday);
      setTotalProducts(totalProducts);
      setTotalOrderAmount(totalOrderAmount);
      setPaymentModeData1(paymentModeData1);
      setOrders(ordersSorted);
      setSplOrders(splOrderData);
      setSGroupQuantities(sGroupQuantities);
      setProductQuantities(productQuantities);

      cache[cacheKey] = {
        data: {
          totalSpecialOrdersToday,
          totalSaleBillToday,
          totalProducts,
          totalOrderAmount,
          paymentModeData1,
          orders: ordersSorted,
          splOrders: splOrderData,
          sGroupQuantities,
          productQuantities,
        },
        timestamp: now,
      };
    } catch (error: unknown) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterType, selectedMonth, selectedYear, startDate, endDate, state.tenantId, router]);

  const productChart = useMemo(() => {
    return {
      data: {
        labels: productQuantities.map((p) => p.prodName),
        datasets: [
          {
            data: productQuantities.map((p) => p.quantity),
            backgroundColor: ["#FFA500", "#A855F7", "#22C55E", "#FF69B4", "#3B82F6"],
            borderColor: ["#FFA500", "#A855F7", "#22C55E", "#FF69B4", "#3B82F6"],
            borderWidth: 1,
          },
        ],
      } as ChartData<"doughnut">,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: { font: { size: 12 }, padding: 8 },
          },
          title: { display: true, text: `Top Products (${filterType.charAt(0).toUpperCase() + filterType.slice(1)})`, font: { size: 14 } },
          tooltip: {
            enabled: true,
            callbacks: {
              label: (ctx: TooltipItem<"doughnut">) => `${ctx.label}: ${ctx.raw} units`,
            },
          },
        },
        animation: {
          animateScale: true,
          animateRotate: true,
        },
      } as ChartOptions<"doughnut">,
    };
  }, [productQuantities, filterType]);

  const paymentModeChart = useMemo(() => ({
    series: [
      {
        name: "Offline Platform",
        data: [paymentModeData1.cash, paymentModeData1.card, paymentModeData1.upi],
      },
      {
        name: "Online Platform",
        data: [paymentModeData2.cash, paymentModeData2.card, paymentModeData2.upi],
      },
    ],
    options: {
      chart: {
        type: "line",
        height: 240,
        background: "#FFFFFF",
        zoom: { enabled: false },
      },
      stroke: {
        curve: "smooth",
        width: 2,
      },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${currency} ${val}`,
        style: {
          fontSize: "10px",
          colors: ["#1F2937"],
        },
      },
      xaxis: {
        categories: ["Cash", "Card", "UPI"],
        labels: { show: false },
        axisTicks: { show: false },
        axisBorder: { show: false },
      },
      yaxis: {
        title: {
          text: `Amount (${currency})`,
          style: {
            color: "#1F2937",
            fontSize: "12px",
          },
        },
        labels: {
          formatter: (val: number) => `${currency} ${val}`,
          style: { colors: "#1F2937" },
        },
      },
      colors: ["#FFD700", "#4ECDC4"],
      title: {
        text: "",
        align: "center",
        style: {
          fontSize: "14px",
          color: "#1F2937",
        },
      },
      legend: {
        show: true,
        position: "right",
        labels: { colors: "#1F2937" },
      },
      tooltip: {
        enabled: true,
        y: {
          formatter: (val: number) => `${currency} ${val}`,
        },
      },
      grid: { borderColor: "#E5E7EB" },
    },
  }), [paymentModeData1, paymentModeData2, currency]);

  const sGroupChart = useMemo(() => ({
    series: [
      {
        name: "Sub-Group Name",
        data: sGroupQuantities.map((s) => s.quantity),
      },
    ],
    options: {
      chart: {
        type: "bar",
        height: 280,
        background: "#FFFFFF",
      },
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: "80%",
          distributed: false,
        },
      },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${val} units`,
        style: {
          fontSize: "10px",
          colors: ["#FFFFFF"],
        },
      },
      xaxis: {
        title: {
          text: "Quantity (units)",
          style: {
            color: "#1F2937",
            fontSize: "12px",
          },
        },
        labels: {
          formatter: (val: number) => `${val}`,
          style: { colors: "#1F2937", fontSize: "12px" },
        },
      },
      yaxis: {
        categories: sGroupQuantities.map((s) => s.sGroupDesc),
        labels: { show: false },
        axisTicks: { show: false },
        axisBorder: { show: false },
      },
      colors: ["#A855F7"],
      title: {
        text: `Top Sub-Groups (${filterType.charAt(0).toUpperCase() + filterType.slice(1)})`,
        align: "center",
        style: {
          fontSize: "14px",
          color: "#1F2937",
        },
      },
      legend: { show: false },
      tooltip: {
        enabled: true,
        y: {
          formatter: (_val: number, { dataPointIndex }: { dataPointIndex: number }) => {
            return `${sGroupQuantities[dataPointIndex]?.sGroupDesc || "Unknown"}`;
          },
        },
      },
      grid: { borderColor: "#E5E7EB" },
    },
  }), [sGroupQuantities, filterType]);

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1, delayChildren: 0.2, ease: easeInOut } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeInOut } },
  };

  const handleKeyDown = (e: React.KeyboardEvent, callback: () => void) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      callback();
    }
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const year = new Date().getFullYear() - i;
    return <option key={year} value={year}>{year}</option>;
  });

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full min-h-screen flex flex-col bg-gray-100 text-gray-900 font-sans"
    >
      <style jsx global>{`
        button:focus, [role="button"]:focus {
          outline: 2px solid #3B82F6;
          outline-offset: 2px;
          border-radius: 4px;
        }
        table th, table td {
          text-align: left;
        }
      `}</style>

      <motion.div variants={containerVariants} className="flex-grow w-full px-2 sm:px-3 md:px-4 lg:px-6 py-3 sm:py-4 md:py-6">
        {loading ? (
          <div className="flex items-center justify-center h-screen w-screen">
            <Loader />
          </div>
        ) : (
          <>
            <motion.header
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="sticky top-0 rounded-sm z-10 bg-gradient-to-r from-blue-700 to-blue-500 shadow-md py-2 px-2 sm:px-3 md:px-4 lg:px-6 w-full flex flex-col sm:flex-row justify-between items-center gap-2"
            >
              <div className="flex flex-col items-center sm:items-start">
                <h1 className="text-white text-lg sm:text-xl font-bold">
                  Welcome {(company?.CName || 'Test Franchise').toLowerCase().split(" ").filter(Boolean).map((word: string) => word[0].toUpperCase() + word.slice(1)).join(" ")} !!
                </h1>
                <p className="text-white text-xs sm:text-xs font-bold">Dashboard</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-white text-lg sm:text-xl mt-1 font-bold">{currentTime.replace(" at ", ",")}</p>
                <div className="relative">
                  <button
                    className="p-2 bg-white text-blue-700 rounded-full hover:bg-gray-200 focus:outline-none"
                    onClick={() => setShowFilterModal(!showFilterModal)}
                    aria-label="Toggle filter options"
                  >
                    <FaFilter className="text-lg" />
                  </button>
                  {showFilterModal && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg p-4 z-20"
                    >
                      <h3 className="text-sm font-semibold mb-2">Filter Data</h3>
                      <div className="mb-2">
                        <label className="block text-xs font-medium">Filter Type</label>
                        <select
                          value={filterType}
                          onChange={(e) => setFilterType(e.target.value as any)}
                          className="w-full p-1 border rounded text-sm"
                        >
                          <option value="today">Today</option>
                          <option value="month">Month</option>
                          <option value="year">Year</option>
                          <option value="custom">Custom Range</option>
                        </select>
                      </div>
                      {filterType === "month" && (
                        <div className="mb-2">
                          <label className="block text-xs font-medium">Select Month</label>
                          <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="w-full p-1 border rounded text-sm"
                          />
                        </div>
                      )}
                      {filterType === "year" && (
                        <div className="mb-2">
                          <label className="block text-xs font-medium">Select Year</label>
                          <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="w-full p-1 border rounded text-sm"
                          >
                            {yearOptions}
                          </select>
                        </div>
                      )}
                      {filterType === "custom" && (
                        <>
                          <div className="mb-2">
                            <label className="block text-xs font-medium">Start Date</label>
                            <input
                              type="date"
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                              className="w-full p-1 border rounded text-sm"
                            />
                          </div>
                          <div className="mb-2">
                            <label className="block text-xs font-medium">End Date</label>
                            <input
                              type="date"
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                              className="w-full p-1 border rounded text-sm"
                            />
                          </div>
                        </>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.header>
            <motion.div
              variants={containerVariants}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 my-2 sm:my-3 w-full"
            >
              {[
                { icon: FaShoppingCart, title: `${filterType.charAt(0).toUpperCase() + filterType.slice(1)}'s Sale Bill Quantity`, value: totalSaleBillToday },
                { icon: FaMoneyBillWave, title: `${filterType.charAt(0).toUpperCase() + filterType.slice(1)}'s Total Sale Amount`, value: `${currency} ${totalOrderAmount.toFixed(2)}` },
                { icon: FaGift, title: `${filterType.charAt(0).toUpperCase() + filterType.slice(1)}'s Special Orders`, value: totalSpecialOrdersToday },
                { icon: FaBox, title: `Total Items Available`, value: totalProducts },
                { icon: FaGlobe, title: `Total Online Integrated Orders`, value: 500 },
              ].map((card, index) => (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  whileHover={{ scale: 1.05, boxShadow: "0 4px 8px rgba(0,0,0,0.2)" }}
                  className="bg-white rounded-lg shadow-md p-2 sm:p-3 text-center flex w-full"
                  aria-label={`${card.title}: ${card.value}`}
                >
                  <div className={`inline-flex items-center justify-center rounded-full border-2 ${cardColors[index % cardColors.length].border} p-2 mb-1`}>
                    <card.icon className={`text-lg sm:text-2xl ${cardColors[index % cardColors.length].color}`} />
                  </div>
                  <div className="flex flex-col w-full h-full justify-center">
                    <h3 className="text-xs sm:text-xs font-semibold">{card.title}</h3>
                    <p className={`text-xl sm:text-xl font-bold ${cardColors[index % cardColors.length].color}`}>{card.value}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            <motion.div variants={containerVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 my-2 sm:my-3 w-full">
              {[
                { chart: productChart, title: `Top Products`, Component: Doughnut, type: "chartjs", data: productQuantities },
                { chart: sGroupChart, title: `Top Sub-Groups`, Component: ApexChart, type: "apex", data: sGroupQuantities },
                { chart: paymentModeChart, title: "Order Modes", Component: ApexChart, type: "apex", data: [paymentModeData1, paymentModeData2] },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  initial={{ rotate: -10, scale: 0.8 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                  className="bg-white rounded-lg shadow-md p-2 sm:p-3 h-64 sm:h-72 flex flex-col justify-center w-full"
                >
                  <h4 className="text-xs font-semibold mb-1">{item.title}</h4>
                  <Suspense fallback={<div className="flex justify-center items-center h-full"><Loader /></div>}>
                    <div className="w-full h-full" aria-hidden={item.type === "chartjs" || item.type === "apex"}>
                      {item.Component === Doughnut && "data" in item.chart && (item.chart.data.labels ?? []).length > 0 ? (
                        <Doughnut data={item.chart.data} options={item.chart.options} ref={chartRef} />
                      ) : item.Component === ApexChart && "series" in item.chart && item.chart.series.length > 0 ? (
                        <ApexChart
                          type={item.chart.options.chart.type as any}
                          series={item.chart.series}
                          options={item.chart.options}
                          height="100%"
                        />
                      ) : (
                        <p className="text-center text-gray-500 text-xs mt-4">No data found.</p>
                      )}
                    </div>
                  </Suspense>
                </motion.div>
              ))}
            </motion.div>

            <motion.div variants={containerVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 my-2 sm:my-3 w-full">
              <motion.div
                variants={itemVariants}
                className="bg-white rounded-lg shadow-md p-2 sm:p-3 w-full"
              >
                <h3 className="text-xs sm:text-sm font-bold">Orders</h3>
                {orders.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full table-auto text-sm sm:text-sm" aria-label="Orders">
                        <thead>
                          <tr className="bg-gradient-to-r from-blue-500 to-teal-500">
                            <th className="p-1 sm:p-1.5">Order No</th>
                            <th className="p-1 sm:p-1.5">Name</th>
                            <th className="p-1 sm:p-1.5">Amount ({currency})</th>
                            <th className="p-1 sm:p-0">Payment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(showAllOrders ? orders : orders.slice(0, 3)).map((order, index) => (
                            <motion.tr
                              key={`order-${order.oaNo}-${index}`}
                              variants={itemVariants}
                              whileHover={{ scale: 1.02, backgroundColor: "#F3F4F6" }}
                              className="border-b border-gray-200"
                            >
                              <td className="p-1 sm:p-1.5">{order.oaNo}</td>
                              <td className="p-1 sm:p-1.5">{order.custName}</td>
                              <td className="p-1 sm:p-1.5">{order.netAmount.toFixed(2)}</td>
                              <td className="p-1 sm:p-1.5">{order.payMode}</td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {orders.length > 3 && (
                      <div
                        className="flex justify-center mt-1 sm:mt-2"
                        role="button"
                        tabIndex={0}
                        onClick={() => setShowAllOrders(!showAllOrders)}
                        onKeyDown={(e) => handleKeyDown(e, () => setShowAllOrders(!showAllOrders))}
                        aria-expanded={showAllOrders ? "true" : "false"}
                        aria-label={showAllOrders ? "Collapse orders list" : "Expand orders list"}
                      >
                        <button
                          className="p-1 sm:p-1.5 rounded-full bg-gray-200"
                          style={{ transform: showAllOrders ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >
                          <FaArrowDown className="text-sm sm:text-sm text-gray-600" />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-center text-gray-500 text-sm sm:text-sm">No orders found.</p>
                )}
              </motion.div>

              <motion.div
                variants={itemVariants}
                className="bg-white rounded-lg shadow-md p-2 sm:p-3 w-full"
              >
                <h3 className="text-sm sm:text-sm font-semibold mb-1 sm:mb-2">Special Orders</h3>
                {splOrders.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full table-auto text-sm sm:text-sm" aria-label="Special Orders table">
                        <thead>
                          <tr className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                            <th className="p-1 sm:p-1.5">Bill No</th>
                            <th className="p-1 sm:p-1.5">Customer</th>
                            <th className="p-1 sm:p-1.5">Amount ({currency})</th>
                            <th className="p-1 sm:p-1.5">Flavor</th>
                            <th className="p-1 sm:p-1.5">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(showAllSplOrders ? splOrders : splOrders.slice(0, 3)).map((splOrder, index) => (
                            <motion.tr
                              key={`splorder-${splOrder.billNo}-${index}`}
                              variants={itemVariants}
                              whileHover={{ scale: 1.02, backgroundColor: "#F3F4F6" }}
                              className={`border-b ${index % 2 === 0 ? "bg-purple-50" : "bg-pink-50"} border-gray-200`}
                            >
                              <td className="p-1 sm:p-1.5">{splOrder.billNo}</td>
                              <td className="p-1 sm:p-1.5">{splOrder.custName}</td>
                              <td className="p-1 sm:p-1.5">{splOrder.amount.toFixed(2)}</td>
                              <td className="p-1 sm:p-1.5">{splOrder.flavor}</td>
                              <td className="p-1 sm:p-1.5">{splOrder.status}</td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {splOrders.length > 3 && (
                      <div
                        className="flex justify-center mt-1 sm:mt-2"
                        role="button"
                        tabIndex={0}
                        onClick={() => setShowAllSplOrders(!showAllSplOrders)}
                        onKeyDown={(e) => handleKeyDown(e, () => setShowAllSplOrders(!showAllSplOrders))}
                        aria-expanded={showAllSplOrders ? "true" : "false"}
                        aria-label={showAllSplOrders ? "Collapse special orders list" : "Expand special orders list"}
                      >
                        <button
                          className="p-1 sm:p-1.5 rounded-full bg-gray-200"
                          style={{ transform: showAllSplOrders ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >
                          <FaArrowDown className="text-sm sm:text-sm text-gray-600" />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-center text-gray-500 text-sm sm:text-sm">No special orders found.</p>
                )}
              </motion.div>
            </motion.div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
};

export default Dashboard;