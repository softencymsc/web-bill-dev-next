/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useContext,
  JSX,
} from "react";
import {
  collection,
  CollectionReference,
  doc,
  DocumentData,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";
import { toast } from "react-toastify";
import Image from "next/image";
import { Easing, motion, Variants } from "framer-motion";
import {
  FaSearch,
  FaTimesCircle,
  FaCloud,
  FaTshirt,
  FaBirthdayCake,
  FaBreadSlice,
  FaMountain,
  FaCookie,
} from "react-icons/fa";
import { FaBars, FaBoxOpen, FaTruck } from "react-icons/fa6";
import ProductCard from "./ProductCard";
import { CounterContext } from "@/lib/CounterContext";
import { Product } from "@/types/page";

const DEFAULT_IMAGE = "/images/default-product.png";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: "easeOut" as Easing },
  },
};

interface AddProductProps {
  tenantId: string;
  page: string | null;
  id: string | null;
}

const AddProduct: React.FC<AddProductProps> = ({ tenantId, page, id }) => {
  const { state, dispatch } = useContext(CounterContext);
  const { products } = state;
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const categoriesRef = useRef<HTMLDivElement>(null);
  const [showArrows, setShowArrows] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [allowNegativeStock, setAllowNegativeStock] = useState<boolean>(true);
  const maxRetries = 3;

  const [currentTime, setCurrentTime] = useState<string>(
    new Date().toLocaleString("en-US", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  );

  // Define the desired category order
  const categoryOrder = [
    "GATEAUX",
    "PASTRY",
    "NON-VEG SAVORIES",
    "BREAD",
    "COOKIES & KHARI",
    "SWEETS",
    "CHOCOLATES",
    "DRY CAKE",
    "INDIAN SNAKES",
    "VEG SAVORIES",
  ];

  useEffect(() => {
    const fetchNegativeStockSetting = async () => {
      try {
        if (!tenantId) {
          // toast.error("Tenant ID is missing");
          return;
        }
        const settingsDoc = doc(db, `TenantsDb/${tenantId}/SETTINGS/negativeStock`);
        const docSnap = await getDocs(collection(db, `TenantsDb/${tenantId}/SETTINGS`));
        const settings = docSnap.docs.find((d) => d.id === "negativeStock");
        if (settings) {
          setAllowNegativeStock(settings.data().allowNegativeStock || false);
        } else {
          setAllowNegativeStock(false);
        }
      } catch (err) {
        // toast.error(`Error fetching negative stock setting: ${err}`);
        setAllowNegativeStock(false);
      }
    };
    fetchNegativeStockSetting();
  }, [tenantId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleString("en-US", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      );
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Restore products from sessionStorage on mount
  useEffect(() => {
    const savedProducts = sessionStorage.getItem("products");
    if (savedProducts && products.length === 0) {
      try {
        const parsedProducts = JSON.parse(savedProducts);
        if (Array.isArray(parsedProducts)) {
          dispatch({ type: "SET_PRODUCTS", payload: parsedProducts });
        }
      } catch (error) {
        console.error("Failed to parse sessionStorage products:", error);
        sessionStorage.removeItem("products");
      }
    }
  }, [dispatch, products.length]);

  // Save products to sessionStorage when they change
  useEffect(() => {
    if (Array.isArray(products) && products.length > 0) {
      try {
        sessionStorage.setItem("products", JSON.stringify(products));
      } catch (error) {
        console.error("Failed to save products to sessionStorage:", error);
      }
    }
  }, [products]);

  // Automatically retry fetching products if none are found
  useEffect(() => {
    if (!loading && products.length === 0 && retryCount < maxRetries) {
      const timeout = setTimeout(() => {
        setLoading(true);
        setRetryCount((prev) => prev + 1);
        toast.info(`Retrying to fetch products... (Attempt ${retryCount + 2})`, {
          position: "top-center",
        });
      }, 2000);
      return () => clearTimeout(timeout);
    } else if (!loading && products.length === 0 && retryCount >= maxRetries) {
      // toast.error("Failed to load products after multiple attempts.", {
      //   position: "top-center",
      // });
    }
  }, [loading, products.length, retryCount]);

  useEffect(() => {
    const fetchProducts = async () => {
      if (!tenantId) {
        // toast.error("Tenant ID is missing. Cannot fetch products.", {
        //   position: "top-center",
        // });
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const productRef = collection(
          db,
          "TenantsDb",
          tenantId,
          "Products"
        ) as CollectionReference<DocumentData>;
        const q = query(productRef, where("AVAILABLE", "==", true));
        const snapshot = await getDocs(q);

        const data: Product[] = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            name: d.DESCRIPT || "",
            category: d.SGroupDesc || "Other",
            price:
              typeof d.RATE === "string" ? parseFloat(d.RATE) : d.RATE || 0,
            image: d.PRODIMG || "",
            OPENING_Q: d.OPENING_Q || "0",
            UOM_SALE: d.UOM_SALE || "",
            SGroupDesc: d.SGroupDesc || "",
            GroupDesc: d.GroupDesc || "",
            DESCRIPT: d.DESCRIPT || "",
            IGST: d.IGST || null,
            DISCOUNTAMT: d.DISCOUNTAMT || 0,
            MRP_RATE: d.RATE || 0,
            QUANTITY: d.QUANTITY || "0",
            PRODCODE: d.PRODCODE || "",
            FOOD_TYPE: d.FOOD_TYPE ?? 0,
            HSNCODE: Number(d.HSNCODE) ?? 0,
            DISCPER: Number(d.DISCPER) ?? 0,
          };
        });

        // Validate product objects to ensure required fields exist
        const isValidProduct = (item: unknown): item is Product => {
          if (typeof item !== "object" || item === null) return false;
          const obj = item as Record<string, unknown>;
          return (
            typeof obj.id === "string" &&
            typeof obj.name === "string" &&
            typeof obj.category === "string" &&
            typeof obj.price === "number"
          );
        };
        const validatedProducts = data.filter(isValidProduct);

        // Merge with sessionStorage products to preserve QUANTITY
        const savedProducts = sessionStorage.getItem("products");
        let mergedProducts: Product[] = validatedProducts;
        if (savedProducts) {
          try {
            const parsedSavedProducts: Product[] = JSON.parse(savedProducts);
            if (Array.isArray(parsedSavedProducts)) {
              mergedProducts = validatedProducts.map((product) => {
                const savedProduct = parsedSavedProducts.find(
                  (p) => p.id === product.id
                );
                return {
                  ...product,
                  QUANTITY: savedProduct?.QUANTITY || product.QUANTITY,
                };
              });
            }
          } catch (error) {
            console.error("Failed to parse sessionStorage products:", error);
          }
        }

        // Get unique categories and sort them according to categoryOrder
        const uniqueCategories = Array.from(
          new Set(mergedProducts.map((item) => item.category))
        );
        // Sort categories: prioritize categoryOrder, then append any other categories
        const sortedCategories = [
          "All",
          ...categoryOrder.filter((cat) => uniqueCategories.includes(cat)),
          ...uniqueCategories
            .filter((cat) => !categoryOrder.includes(cat) && cat !== "Other")
            .sort(),
          ...(uniqueCategories.includes("Other") ? ["Other"] : []),
        ];
        setCategories(sortedCategories);
        dispatch({ type: "SET_PRODUCTS", payload: mergedProducts });
      } catch (error: unknown) {
        console.error("Error fetching products:", error);
        // toast.error(
        //   `Failed to load products: ${
        //     error instanceof Error ? error.message : "Unknown error"
        //   }`,
        //   {
        //     position: "top-center",
        //   }
        // );
      } finally {
        setLoading(false);
      }
    };
    if (loading) {
      fetchProducts();
    }
  }, [tenantId, dispatch, loading]);

  const filteredItems = useMemo(() => {
    let filtered = products;

    // Filter out products with OPENING_Q <= 0 if page is purchaseReturn
    if (page === "purchaseReturn") {
      filtered = filtered.filter((item) => Number(item.OPENING_Q) > 0 || !item.OPENING_Q);
    }

    if (selectedCategory !== "All") {
      filtered = filtered.filter((item) => item.category === selectedCategory);
    }

    if (searchTerm) {
      filtered = filtered.filter((item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort products by category based on categoryOrder
    return filtered.sort((a, b) => {
      const aIndex = categoryOrder.indexOf(a.category);
      const bIndex = categoryOrder.indexOf(b.category);

      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      if (aIndex !== -1) {
        return -1;
      }
      if (bIndex !== -1) {
        return 1;
      }

      if (a.category === "Other") {
        return 1;
      }
      if (b.category === "Other") {
        return -1;
      }

      return a.category.localeCompare(b.category);
    });
  }, [products, selectedCategory, searchTerm, page]);

  useEffect(() => {
    const checkOverflow = () => {
      if (categoriesRef.current) {
        setShowArrows(
          categoriesRef.current.scrollWidth > categoriesRef.current.clientWidth
        );
      }
    };
    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [categories]);

  const scrollBy = (amount: number) => {
    if (categoriesRef.current) {
      categoriesRef.current.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  const [categoryImages, setCategoryImages] = useState<Record<string, string>>(
    {}
  );

  useEffect(() => {
    const images: Record<string, string> = {};
    products.forEach((prod) => {
      if (!images[prod.category] && prod.image) {
        images[prod.category] = prod.image;
      }
    });
    setCategoryImages(images);
  }, [products]);

  // Category icons
  const categoryIcons: Record<string, JSX.Element> = {
    All: <FaCloud className="text-sm" />,
    GATEAUX: <FaBirthdayCake className="text-xs" />,
    PASTRY: <FaMountain className="text-xs" />,
    "NON-VEG SAVORIES": <FaTshirt className="text-xs" />,
    BREAD: <FaBreadSlice className="text-xs" />,
    "COOKIES & KHARI": <FaCookie className="text-xs" />,
    SWEETS: <FaCookie className="text-xs" />,
    CHOCOLATES: <FaCookie className="text-xs" />,
    "DRY CAKE": <FaBirthdayCake className="text-xs" />,
    "INDIAN SNAKES": <FaBreadSlice className="text-xs" />,
    "VEG SAVORIES": <FaBreadSlice className="text-xs" />,
    Other: <FaCloud className="text-xs" />,
  };

  // Category colors
  const categoryColors: Record<string, string> = {
    GATEAUX: "text-pink-200",
    PASTRY: "text-green-400",
    "NON-VEG SAVORIES": "text-red-300",
    BREAD: "text-blue-300",
    "COOKIES & KHARI": "text-yellow-300",
    SWEETS: "text-orange-300",
    CHOCOLATES: "text-brown-400",
    "DRY CAKE": "text-purple-300",
    "INDIAN SNAKES": "text-green-300",
    "VEG SAVORIES": "text-green-500",
    Other: "text-gray-400",
  };

  return (
    <div className="bg-[#F9F9F9] min-h-screen h-screen p-4 font-[Inter,sans-serif]">
      <div className="max-w-7xl mx-auto h-full flex flex-col">
        {/* Sticky Category Section */}
        <div className="sticky no-scrollbar top-0 z-10 bg-[#F9F9F9] pt-1 pb-2">
          <div className="flex space-x-3 overflow-x-auto no-scrollbar mb-2 relative">
            {showArrows && (
              <motion.button
                className="p-2 bg-white rounded-full border border-gray-300 text-gray-600 z-10"
                onClick={() => scrollBy(-150)}
                aria-label="Previous categories"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                  <path
                    d="M13 15l-5-5 5-5"
                    stroke="#333"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.button>
            )}
            <motion.div
              ref={categoriesRef}
              className="flex space-x-3 overflow-x-auto scrollbar-hide"
              initial="hidden"
              animate="show"
              variants={container}
            >
              {categories.map((category) => {
                // Calculate item count based on category
                const itemCount =
                  category === "All"
                    ? products.length // Total available products for "All"
                    : products
                        .filter((item) => item.category === category)
                        .filter((item) =>
                          searchTerm
                            ? item.name
                                .toLowerCase()
                                .includes(searchTerm.toLowerCase())
                            : true
                        ).length;
                const isSelected = selectedCategory === category;

                return (
                  <motion.button
                    key={category}
                    className={`flex my-2 flex-col items-center justify-center min-w-[90px] rounded-xl border-2 ${
                      isSelected
                        ? "border-blue-600 bg-white text-blue-600"
                        : "border-gray-200 bg-white text-gray-700"
                    } px-3 py-3`}
                    onClick={() => setSelectedCategory(category)}
                    variants={itemVariants}
                    whileHover={{ scale: 1.05 }}
                  >
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-lg border ${
                        isSelected ? "border-blue-600" : "border-gray-300"
                      } mb-1 bg-gray-50 overflow-hidden`}
                    >
                      {categoryImages[category] ? (
                        <Image
                          src={categoryImages[category]}
                          alt={category}
                          width={28}
                          height={28}
                          className="object-cover rounded"
                        />
                      ) : (
                        categoryIcons[category] || (
                          <FaCloud className="text-xs" />
                        )
                      )}
                    </div>
                    <span className="text-sm font-semibold truncate max-w-[70px]">
                      {category}
                    </span>
                    <span className="text-xs text-gray-400">
                      {itemCount} Items
                    </span>
                  </motion.button>
                );
              })}
            </motion.div>
            {showArrows && (
              <motion.button
                className="p-2 bg-white rounded-full border border-gray-300 text-gray-600 z-10"
                onClick={() => scrollBy(150)}
                aria-label="Next categories"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                  <path
                    d="M7 5l5 5-5 5"
                    stroke="#333"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <motion.div
          className="relative mb-6 mt-2 w-full"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <input
            type="text"
            placeholder="Search something sweet on your mind..."
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-4 pr-10 text-sm text-gray-500 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <FaSearch className="text-gray-400 text-sm" />
          </span>
        </motion.div>

        {/* Scrollable Product Grid */}
        <div className="flex-1 min-h-0 w-full">
          <motion.div
            className="h-full overflow-y-auto overflow-x-hidden pr-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3"
            initial="hidden"
            animate="show"
            variants={container}
          >
            {loading ? (
              Array(8)
                .fill(0)
                .map((_, i) => (
                  <motion.div
                    key={i}
                    className="bg-white rounded-xl p-3 shadow-sm flex flex-col items-center animate-pulse"
                    variants={itemVariants}
                  >
                    <div className="w-[120px] h-[90px] bg-gray-200 rounded-lg mb-3"></div>
                    <div className="h-5 w-4/5 bg-gray-200 rounded mb-1"></div>
                    <div className="h-4 w-3/5 bg-gray-200 rounded mb-1"></div>
                    <div className="h-4 w-2/5 bg-gray-200 rounded"></div>
                  </motion.div>
                ))
            ) : filteredItems.length === 0 ? (
              <motion.div
                className="col-span-full text-center text-gray-600 text-sm flex flex-col items-center gap-3"
                variants={itemVariants}
              >
                <FaBoxOpen className="text-4xl text-gray-300" />
                <span>
                  {products.length === 0
                    ? retryCount >= maxRetries
                      ? "No products available."
                      : "Retrying to fetch products..."
                    : "No products match your search or filter."}
                </span>
                {products.length === 0 && retryCount < maxRetries ? null : (
                  <button
                    className="text-blue-500 font-semibold hover:text-blue-600"
                    onClick={() => {
                      setLoading(true);
                      setRetryCount(0);
                    }}
                  >
                    Retry
                  </button>
                )}
              </motion.div>
            ) : (
              filteredItems.map((item) => {
                // Find the product in state.products to get the latest QUANTITY
                const contextProduct = products.find((p) => p.id === item.id);
                return (
                  <motion.div
                    key={item.id}
                    className="cursor-pointer"
                  >
                    <ProductCard
                      data={{
                        ...item,
                        image: item.image || DEFAULT_IMAGE,
                        DESCRIPT: item.name,
                        SGroupDesc: item.category,
                        MRP_RATE: item.price,
                        OPENING_Q: item.OPENING_Q,
                        FOOD_TYPE: item.FOOD_TYPE || 0,
                        QUANTITY: contextProduct?.QUANTITY || item.QUANTITY || "0",
                      }}
                      allowNegativeStock={allowNegativeStock}
                      whichPage={page}
                    />
                  </motion.div>
                );
              })
            )}
          </motion.div>
        </div>

        <style jsx global>{`
          .scrollbar-hide {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </div>
    </div>
  );
};

export default AddProduct;