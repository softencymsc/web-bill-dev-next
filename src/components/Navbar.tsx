/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  MdDashboard,
  MdOutlineSettings,
  MdPerson,
  MdBook,
  MdOutlineBorderColor,
  MdOutlineFolderSpecial,
  MdMobileFriendly,
  MdHelpCenter,
} from "react-icons/md";
import { VscFileSubmodule } from "react-icons/vsc";
import { RiBillFill } from "react-icons/ri";
import { BiSolidReceipt } from "react-icons/bi";
import { LiaFile, LiaFileInvoiceSolid } from "react-icons/lia";
import { BsFileEarmarkBarGraph, BsBoxes } from "react-icons/bs";
import { SlBriefcase } from "react-icons/sl";
import { GoPerson } from "react-icons/go";
import { FaCashRegister, FaPeopleLine, FaBars, FaUser } from "react-icons/fa6";
import { FaTimes, FaShoppingCart } from "react-icons/fa";
import { TbTruckReturn, TbReport, TbFileInvoice } from "react-icons/tb";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";

interface SubNavLink {
  name: string;
  path: string;
  icon: React.ReactNode;
}

interface NavLink {
  name: string;
  path: string;
  icon: React.ReactNode;
  visible: boolean;
  subItems: SubNavLink[];
  isOpen?: boolean;
  toggle?: () => void;
}

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const adminView = true;
  const orderView = true;
  const staffView = true;
  const tenant = { role: "ADMIN" };
  const router = useRouter();

  // Auto-close mobile menu after 5 seconds
  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;
    if (isMobileMenuOpen) {
      timeout = setTimeout(() => {
        setIsMobileMenuOpen(false);
        setOpenMenu(null); // Close any open sub-menus
      }, 5000);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isMobileMenuOpen]);

  // Auto-close submenus after 3 seconds for desktop and tablet
  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;
    if (openMenu && !isMobileMenuOpen) { // Only for desktop/tablet (not mobile)
      timeout = setTimeout(() => {
        setOpenMenu(null); // Close submenu
      }, 3000); // 3 seconds
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [openMenu, isMobileMenuOpen]);

  const handleMenuToggle = (menuName: string) => {
    setOpenMenu(openMenu === menuName ? null : menuName);
  };

  const isSignedIn = () => {
    if (typeof window === "undefined") return false;
    const token = sessionStorage.getItem("token");
    const tenant = localStorage.getItem("tenant");
    const company = localStorage.getItem("company");
    return !!(token && tenant && company);
  };

  const handleUserIconClick = () => {
    if (!isSignedIn()) {
      router.push("/login");
    } else {
      setShowUserMenu((prev) => !prev);
    }
  };

  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.clear();
    document.cookie.split(";").forEach((c) => {
      const eqPos = c.indexOf("=");
      const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    });
    if (window.indexedDB && indexedDB.databases) {
      indexedDB.databases().then((dbs) => {
        dbs.forEach((db) => {
          if (db.name) indexedDB.deleteDatabase(db.name);
        });
      });
    }
    setShowUserMenu(false);
    router.push("/login");
    window.location.reload();
  };

  const handleSubMenuClick = () => {
    setOpenMenu(null);
    setIsMobileMenuOpen(false);
  };

  const menuItems: NavLink[] = [
    {
      name: "Dashboard",
      path: "/",
      icon: <MdDashboard className="w-3 h-3" />,
      visible: adminView || orderView || staffView,
      subItems: [],
    },
    {
      name: "Master",
      path: "",
      icon: <VscFileSubmodule className="w-3 h-3" />,
      visible: adminView || staffView,
      isOpen: openMenu === "Master",
      toggle: () => handleMenuToggle("Master"),
      subItems: [
        {
          name: "Customer",
          path: "/master/customer",
          icon: <GoPerson className="w-2.5 h-2.5" />,
        },
        {
          name: "Salesman / Agent",
          path: "/master/agent",
          icon: <MdPerson className="w-2.5 h-2.5" />,
        },
        {
          name: "Vendor",
          path: "/master/vendor",
          icon: <MdPerson className="w-2.5 h-2.5" />,
        },
        {
          name: "Product",
          path: "/master/product",
          icon: <BsBoxes className="w-2.5 h-2.5" />,
        },
        {
          name: "Product Opening",
          path: "/master/productopening",
          icon: <BsBoxes className="w-2.5 h-2.5" />,
        },
        {
          name: "Ledger",
          path: "/master/ledger",
          icon: <MdBook className="w-2.5 h-2.5" />,
        },
      ],
    },
    {
      name: "Sales",
      path: "",
      icon: <FaCashRegister className="w-3 h-3" />,
      visible: adminView,
      isOpen: openMenu === "Sales",
      toggle: () => handleMenuToggle("Sales"),
      subItems: [
        {
          name: "Sale Order",
          path: "/sale/order",
          icon: <FaCashRegister className="w-2.5 h-2.5" />,
        },
        {
          name: "Sale Bill",
          path: "/sale/bill",
          icon: <FaCashRegister className="w-2.5 h-2.5" />,
        },
      ],
    },
    {
      name: "Bill",
      path: "/sale/bill/add",
      icon: <RiBillFill className="w-3 h-3" />,
      visible: adminView || staffView,
      subItems: [],
    },
    {
      name: "Purchase",
      path: "",
      icon: <BiSolidReceipt className="w-3 h-3" />,
      visible: adminView || orderView || staffView,
      isOpen: openMenu === "Purchase",
      toggle: () => handleMenuToggle("Purchase"),
      subItems: [
        {
          name: "Order",
          path: "/purchase/order",
          icon: <MdOutlineBorderColor className="w-2.5 h-2.5" />,
        },
        {
          name: "Special",
          path: "/purchase/special/order",
          icon: <MdOutlineFolderSpecial className="w-2.5 h-2.5" />,
        },
        {
          name: "Packing",
          path: "/purchase/packing",
          icon: <BsBoxes className="w-2.5 h-2.5" />,
        },
        {
          name: "Bill",
          path: "/purchase/bill",
          icon: <FaCashRegister className="w-2.5 h-2.5" />,
        },
        {
          name: "Return",
          path: "/purchase/return",
          icon: <TbTruckReturn className="w-2 h-2" />,
        },
      ],
    },
    
    {
      name: "Entry",
      path: "",
      icon: <BsFileEarmarkBarGraph className="w-3 h-3" />,
      visible: adminView || true,
      isOpen: openMenu === "Entry",
      toggle: () => handleMenuToggle("Entry"),
      subItems: [
        {
          name: "Voucher",
          path: "/voucher",
          icon: <LiaFileInvoiceSolid className="w-3 h-4" />,  
        },
        {
          name: "Journal",
          path: "/entry/journal",
          icon: <LiaFile className="w-2.5 h-2.5" />,
        }
      ],
    },
    {
      name: "Reports",
      path: "",
      icon: <BsFileEarmarkBarGraph className="w-3 h-3" />,
      visible: adminView || true,
      isOpen: openMenu === "Reports",
      toggle: () => handleMenuToggle("Reports"),
      subItems: [
        {
          name: "Sales",
          path: "/report/sale/order",
          icon: <TbReport className="w-2.5 h-2.5" />,
        },
        {
          name: "Invoice",
          path: "/report/sale/invoice",
          icon: <LiaFileInvoiceSolid className="w-2.5 h-2.5" />,
        },
        {
          name: "Purchase order",
          path: "/report/purchase/order",
          icon: <TbReport className="w-2.5 h-2.5" />,
        },
        {
          name: "Purchase Invoice",
          path: "/report/purchase/invoice",
          icon: <TbFileInvoice className="w-2.5 h-2.5" />,
        },
        {
          name: "Cash & Bank",
          path: "/report/cashbank",
          icon: <TbReport className="w-2.5 h-2.5" />,
        },
        {
          name: "Journal Report",
          path: "/report/journal",
          icon: <TbReport className="w-2.5 h-2.5" />,
        },
        {
          name: "General Ledger",
          path: "/report/general_ledger",
          icon: <TbReport className="w-2.5 h-2.5" />,
        },
      ],
    },
    {
      name: "Business",
      path: "",
      icon: <SlBriefcase className="w-3 h-3" />,
      visible: adminView || staffView,
      isOpen: openMenu === "Business",
      toggle: () => handleMenuToggle("Business"),
      subItems: [
        {
          name: "Automation",
          path: "/businessarena",
          icon: <MdMobileFriendly className="w-2.5 h-2.5" />,
        },
        ...(staffView
          ? []
          : [
              {
                name: "Staff",
                path: "/staff",
                icon: <FaPeopleLine className="w-2.5 h-2.5" />,
              },
            ]),
      ],
    },
    {
      name: "Settings",
      path: "",
      icon: <MdOutlineSettings className="w-3 h-3" />,
      visible: tenant?.role === "ADMIN",
      isOpen: openMenu === "Settings",
      toggle: () => handleMenuToggle("Settings"),
      subItems: [
        {
          name: "Settings",
          path: "/settings",
          icon: <MdOutlineSettings className="w-2.5 h-2.5" />,
        },
        {
          name: "Help",
          path: "/help",
          icon: <MdHelpCenter className="w-2.5 h-2.5" />,
        },
      ],
    },
  ];

  const dropdownVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.2 },
    },
  };

  const mobileMenuVariants = {
    hidden: { x: "-100%" },
    visible: {
      x: "0%",
      transition: { type: "spring" as const, stiffness: 300, damping: 30 },
    },
  };

  return (
    <nav className="sticky top-0 z-[999] bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 border-b border-white/30 shadow-md text-white">
      <div className="max-w-screen-xl mx-auto px-2 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-12">
          {/* Logo */}
          <div className="flex-shrink-0">
            <div className="relative w-6 h-6">
              <Image
                className="scale-125"
                src="/tnb4.png"
                alt="Cake Shop POS Logo"
                fill
                style={{ objectFit: "contain" }}
                sizes="(max-width: 768px) 24px, 48px"
                priority
              />
            </div>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-1.5">
            {menuItems.map((item, index) =>
              item.visible ? (
                <div key={index} className="relative group">
                  {item.subItems.length > 0 ? (
                    <>
                      <button
                        onClick={item.toggle}
                        className="flex items-center px-2.5 py-1.5 text-xs font-medium rounded-md bg-white/10 hover:bg-white/20 transition duration-200"
                      >
                        {item.icon}
                        <span className="ml-1.5">{item.name}</span>
                      </button>
                      <AnimatePresence>
                        {item.isOpen && (
                          <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            variants={dropdownVariants}
                            className="absolute top-10 left-0 bg-white text-blue-900 py-1.5 z-[1000] min-w-[120px] md:min-w-[160px] border border-blue-200 rounded-md shadow-xl"
                          >
                            {item.subItems.map((subItem, subIndex) => (
                              <Link
                                key={subIndex}
                                href={subItem.path}
                                onClick={handleSubMenuClick}
                                className="flex items-center px-2.5 py-1.5 text-[0.65rem] font-medium hover:bg-blue-50 transition-all duration-200"
                              >
                                {subItem.icon}
                                <span className="ml-1.5">{subItem.name}</span>
                              </Link>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  ) : (
                    <Link
                      href={item.path}
                      className="flex items-center px-2.5 py-1.5 text-xs font-medium rounded-md bg-white/10 hover:bg-white/20 transition-all duration-200"
                    >
                      {item.icon}
                      <span className="ml-1.5">{item.name}</span>
                    </Link>
                  )}
                </div>
              ) : null
            )}
          </div>

          {/* Right Side Icons */}
          <div className="flex items-center space-x-1 relative">
            <button
              className="p-1.5 hover:bg-white/20 rounded-md transition"
              aria-label="User"
              onClick={handleUserIconClick}
            >
              <FaUser size={16} />
            </button>
            <AnimatePresence>
              {isSignedIn() && showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute right-0 top-10 bg-white text-blue-900 border border-blue-200 rounded-md shadow-xl z-[1000] min-w-[100px]"
                >
                  <button
                    className="block w-full text-left px-2.5 py-1.5 text-[0.65rem] hover:bg-blue-50"
                    onClick={() => {
                      setShowUserMenu(false);
                      router.push("/profile");
                    }}
                  >
                    Profile
                  </button>
                  <button
                    className="block w-full text-left px-2.5 py-1.5 text-[0.65rem] hover:bg-blue-50"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
       
            {/* Mobile Menu Toggle */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-1.5 hover:bg-white/20 rounded-md transition"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <FaTimes size={16} /> : <FaBars size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={mobileMenuVariants}
            className="fixed top-0 left-0 h-full w-3/5 max-w-[200px] z-[1000] bg-white/90 backdrop-blur-xl border-r border-blue-200 pt-12"
          >
            <div className="px-2 pb-2 space-y-0.5">
              {menuItems.map((item, index) =>
                item.visible ? (
                  <motion.div
                    key={index}
                    initial={{ x: -50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.1, duration: 0.3 }}
                  >
                    {item.subItems.length > 0 ? (
                      <>
                        <button
                          onClick={item.toggle}
                          className="w-full text-left flex items-center px-2 py-1 text-xs font-medium text-blue-900 hover:bg-blue-100 rounded transition"
                        >
                          {item.icon}
                          <span className="ml-1.5">{item.name}</span>
                        </button>
                        {item.isOpen && (
                          <div className="pl-3 space-y-0.5">
                            {item.subItems.map((subItem, subIndex) => (
                              <motion.div
                                key={subIndex}
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: (index + subIndex * 0.05) * 0.1, duration: 0.2 }}
                              >
                                <Link
                                  href={subItem.path}
                                  onClick={() => setIsMobileMenuOpen(false)}
                                  className="flex items-center px-2 py-1 text-[0.65rem] font-medium text-blue-900 hover:bg-blue-100 rounded transition"
                                >
                                  {subItem.icon}
                                  <span className="ml-1.5">{subItem.name}</span>
                                </Link>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <Link
                        href={item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center px-2 py-1 text-xs font-medium text-blue-900 hover:bg-blue-100 rounded transition"
                      >
                        {item.icon}
                        <span className="ml-1.5">{item.name}</span>
                      </Link>
                    )}
                  </motion.div>
                ) : null
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;