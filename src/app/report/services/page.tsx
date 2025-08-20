/* eslint-disable @typescript-eslint/no-explicit-any */
import { Timestamp, query, where, getDocs } from "@firebase/firestore";

// Conditionally import toast only on the client side
import { toast } from "react-toastify";

const fetchSingleCollectionByDate = async ({
  collectionRef,
  startDate,
  endDate,
  FDATE,
}: any): Promise<any[]> => {
  // Check if running on the client side
  const isClient = typeof window !== "undefined";

  if (!startDate || !endDate) {
    if (isClient) {
      // toast.error("Date not Selected", {
      //   position: "top-center",
      //   autoClose: 600,
      //   hideProgressBar: true,
      //   closeOnClick: true,
      //   pauseOnHover: true,
      //   draggable: true,
      //   progress: undefined,
      //   theme: "colored",
      // });
    } else {
      console.error("Date not selected (server-side)");
    }
    return [];
  }

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const q = query(
      collectionRef,
      where(FDATE, ">=", Timestamp.fromDate(start)),
      where(FDATE, "<=", Timestamp.fromDate(end))
    );

    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc: any) => doc.data());
    return data;
  } catch (error) {
    console.error("Error fetching data:", error);
    return [];
  }
};

export default fetchSingleCollectionByDate;