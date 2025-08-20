/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import Image from "next/image";
import React, { useContext, useCallback, useMemo, useState, useEffect } from "react";
import { Product } from "@/types/page";
import { CounterContext } from "@/lib/CounterContext";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";

interface ProductCardProps {
  data: Product;
  allowNegativeStock: boolean;
  whichPage: string | null;
}

const ProductCard = ({ data, allowNegativeStock, whichPage }: ProductCardProps) => {
  const { state, dispatch } = useContext(CounterContext);
  const count = Number(data.QUANTITY) || 0;
  const stockQty = Number(data.OPENING_Q) || 0;
  const [stockCount, setStockCount] = useState(stockQty);
  const [warned, setWarned] = useState<boolean>(false);
  const currency = state.currency;

  // Memoize product existence check
  const productExists = useMemo(
    () => state.products.find((p) => p.id === data.id),
    [state.products, data.id]
  );

  // Create new product object
  const createNewProduct = useCallback(
    (quantity: string): Product => ({
      id: String(data.id),
      name: data.DESCRIPT,
      category: data.SGroupDesc,
      price: Number(data.MRP_RATE),
      image: data.image || "/placeholder-image.png",
      OPENING_Q: data.OPENING_Q || "0",
      UOM_SALE: (data as any).UOM_SALE || "",
      SGroupDesc: data.SGroupDesc || "",
      GroupDesc: (data as any).GroupDesc || "",
      DESCRIPT: data.DESCRIPT || "",
      IGST: (data as any).IGST || 0,
      DISCOUNTAMT: (data as any).DISCOUNTAMT || 0,
      MRP_RATE: Number(data.MRP_RATE) || 0,
      QUANTITY: quantity,
      PRODCODE: (data as any).PRODCODE || "",
      FOOD_TYPE: data.FOOD_TYPE || 0,
      HSNCODE: data.HSNCODE || 0,
      DISCPER: data.DISCPER || 0,
    }),
    [data]
  );

  // Calculate available stock
  const howMuchAvailableStock = () => {
    if (whichPage === "purchaseBill" || whichPage === "purchaseOrder") {
      return stockCount + count;
    } else {
      return stockCount - count;
    }
  };

  const newStock = howMuchAvailableStock();

  // Optimized update function
  const updateProductAndAdded = useCallback(
    (newCount: number) => {
      const newProduct = productExists
        ? { ...productExists, QUANTITY: String(newCount) }
        : createNewProduct(String(newCount));

      dispatch({
        type: "UPDATE_BOTH",
        payload: {
          products: productExists
            ? state.products.map((p) =>
                p.id === data.id ? newProduct : p
              )
            : [...state.products, newProduct],
          addedProducts: state.addedProducts.find((p) => p.id === data.id)
            ? state.addedProducts.map((p) =>
                p.id === data.id ? newProduct : p
              )
            : [...state.addedProducts, newProduct],
        },
      });
    },
    [dispatch, productExists, state.products, state.addedProducts, data.id, createNewProduct]
  );

  // Reset warned state when count changes
  useEffect(() => {
    setWarned(false);
  }, [count]);

  // Handle increment (image click)
  const handleImageClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();

      if (whichPage === "purchaseBill" || whichPage === "purchaseOrder") {
        // Allow adding products regardless of stock for Purchase Bill/Order
        updateProductAndAdded(count + 1);
      } else if (whichPage === "Sale Bill" || whichPage === "Sale Order") {
        // Apply stock restrictions for Sale Bill/Order
        if (allowNegativeStock || count < stockQty) {
          if (stockQty - count <= 0 && !warned) {
            // toast.error("No stock left, please add more!", {
            //   position: "bottom-right",
            //   duration: 2000,
            // });
            setWarned(true);
          }
          updateProductAndAdded(count + 1);
        } else {
          // toast.error("Product out of stock", {
          //   position: "bottom-right",
          //   duration: 2000,
          // });
        }
      } else if (whichPage === "purchaseReturn") {
        // For Purchase Return, allow adding up to available stock
        if (allowNegativeStock || count < stockQty) {
          if (stockQty - count <= 0 && !warned) {
            // toast.error("No stock left to return!", {
            //   position: "bottom-right",
            //   duration: 2000,
            // });
            setWarned(true);
          }
          updateProductAndAdded(count + 1);
        } else {
          // toast.error("Cannot return more than available stock", {
          //   position: "bottom-right",
          //   duration: 2000,
          // });
        }
      }
    },
    [count, stockQty, allowNegativeStock, updateProductAndAdded, whichPage, warned]
  );

  // Handle decrement (bottom section click)
  const handleBottomClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (count <= 1) {
        dispatch({
          type: "REMOVE_BOTH",
          payload: String(data.id),
        });
      } else if (count > 0) {
        updateProductAndAdded(count - 1);
      }
    },
    [count, dispatch, data.id, updateProductAndAdded]
  );

  // Input change handler
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (isNaN(Number(value))) {
        // toast.error("Only numbers are allowed", {
        //   position: "bottom-right",
        //   duration: 2000,
        // });
        return;
      }

      const newCount = Number(value) || 0;
      if (newCount < 0) {
        // toast.error("Quantity cannot be negative", {
        //   position: "bottom-right",
        //   duration: 2000,
        // });
        return;
      }

      if (newCount === 0) {
        dispatch({
          type: "REMOVE_BOTH",
          payload: String(data.id),
        });
      } else if (whichPage === "purchaseBill" || whichPage === "purchaseOrder") {
        // Allow any positive quantity for Purchase Bill/Order
        if (stockQty === 0 && !warned) {
          // toast.error("No stock available, but you can still add for purchase!", {
          //   position: "bottom-right",
          //   duration: 2000,
          // });
          setWarned(true);
        }
        updateProductAndAdded(newCount);
      } else if (whichPage === "purchaseReturn") {
        // For Purchase Return, allow adding up to available stock
        if (allowNegativeStock || newCount <= stockQty) {
          if (stockQty - newCount < 0 && !warned) {
            // toast.error("No stock left to return!", {
            //   position: "bottom-right",
            //   duration: 2000,
            // });
            setWarned(true);
          }
          updateProductAndAdded(newCount);
        } else {
          // toast.error("Cannot return more than available stock", {
          //   position: "bottom-right",
          //   duration: 2000,
          // });
        }
      } else if (allowNegativeStock || newCount <= stockQty) {
        // Apply stock restrictions for Sale Bill/Order
        updateProductAndAdded(newCount);
      } else {
        // toast.error("Product out of stock", {
        //   position: "bottom-right",
        //   duration: 2000,
        // });
      }
    },
    [dispatch, data.id, stockQty, allowNegativeStock, updateProductAndAdded, whichPage, warned]
  );

  const handleInputClick = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
    e.currentTarget.focus();
  }, []);

  // Border and dot color logic
  const { borderColor, dotColor } = useMemo(() => {
    let borderColor = "border-gray-300";
    let dotColor = "bg-white";
    if (data.FOOD_TYPE === 1) {
      borderColor = "border-green-700";
      dotColor = "bg-green-700";
    } else if (data.FOOD_TYPE === 2) {
      borderColor = "border-red-700";
      dotColor = "bg-red-700";
    }
    return { borderColor, dotColor };
  }, [data.FOOD_TYPE]);

  return (
    <motion.div
      className="md:w-36 xl:w-40 h-64 px-2 pt-2 pb-3 rounded-2xl bg-[#fdfdfd] border border-gray-200 cursor-pointer shadow-sm shadow-gray-400 relative select-none overflow-hidden"
      whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
      whileHover={{ scale: 1.02 }}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, transition: { duration: 0.2 } }}
    >
      <div
        className="w-full h-[45%] relative rounded-xl overflow-hidden shadow-sm"
        onClick={handleImageClick}
      >
        <Image
          src={data.image || "/placeholder-image.png"}
          alt="Image"
          fill
          className="object-cover shadow shadow-gray-400 bg-gray-100"
          sizes="60vw"
        />
      </div>

      <div
        className="px-1 py-2 flex flex-col justify-between h-[55%]"
        onClick={handleBottomClick}
      >
        <div className="flex justify-between items-start">
          <div className="font-bold text-[13px] text-gray-800 leading-snug line-clamp-2">
            {data.DESCRIPT}
          </div>
          <div
            className={`text-xs ${newStock === 0 ? "text-red" : "text-black"} font-semibold px-2 py-0.5 rounded-xl shadow shadow-green-200 drop-shadow-2xl`}
          >
            {newStock}
          </div>
        </div>

        <div className="flex justify-between items-center mt-2">
          {data.FOOD_TYPE === 2 || data.FOOD_TYPE === 1 ? (
            <div className={`h-4 w-4 flex items-center justify-center shadow-inner border-2 ${borderColor}`}>
              {dotColor === "bg-red-700" ? (
                <div className="w-0 h-0 border-l-5 border-r-5 border-b-8 border-transparent border-b-red-700" />
              ) : (
                <div className={`h-2 w-2 rounded-sm ${dotColor}`} />
              )}
            </div>
          ) : null}

          <div className="text-[13px] text-black font-semibold tracking-tight">
            {currency + " "} {data.MRP_RATE}
          </div>
        </div>

        {count > 0 && (
          <div
            className="quantity-controls shadow shadow-gray-400 mt-3 translate-y-2 border border-gray-300 flex items-center justify-center w-full bg-white rounded-full px-3 py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              value={count}
              onChange={handleInputChange}
              onClick={handleInputClick}
              className="w-14 text-center text-sm font-semibold text-gray-800 border-none outline-none bg-transparent focus:ring-1 focus:ring-blue-500"
              inputMode="numeric"
              pattern="[0-9]*"
            />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ProductCard;