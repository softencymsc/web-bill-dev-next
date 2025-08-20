/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDocs, query, where, Timestamp, Query } from 'firebase/firestore';
import { toast } from 'react-toastify';
import type { DocumentData, QuerySnapshot } from 'firebase/firestore';

// Define interfaces for type safety
interface BillData {
  [key: string]: any;
}

interface BillDetailData {
  SGroupDesc?: string;
  [key: string]: any;
}

interface CombinedData {
  BillNumber: string;
  customerDetails: BillData;
  productsData: BillDetailData[];
}

// Define parameter types
interface FetchAndMapParams {
  collection1: any; // Replace with specific Firestore collection type if available
  collection2: any; // Replace with specific Firestore collection type if available
  startDate: string;
  endDate: string;
  selectedPaymentType: string;
  selectedSubGroup: string;
  setSubgroupsArray: (subgroups: string[]) => void;
  FDATE: string;
  FNUMBER: string;
}

export const fetchAndMapWithQueries = async ({
  collection1,
  collection2,
  startDate,
  endDate,
  selectedPaymentType,
  selectedSubGroup,
  setSubgroupsArray,
  FDATE,
  FNUMBER,
}: FetchAndMapParams): Promise<CombinedData[] | undefined> => {
  if (!startDate || !endDate) {
    // toast.error('Date not Selected', {
    //   position: 'top-center',
    //   autoClose: 600,
    //   hideProgressBar: true,
    //   closeOnClick: true,
    //   pauseOnHover: true,
    //   draggable: true,
    //   progress: undefined,
    //   theme: 'colored',
    // });
    return undefined;
  }

  try {
    const startDateTimestamp = new Date(startDate).getTime();
    const endDateTimestamp = new Date(endDate).setHours(23, 59, 59, 999);

    // Define queries with type annotations
    const snapshotCash: Query<DocumentData> = query(
      collection1,
      where(FDATE, '>=', Timestamp.fromMillis(startDateTimestamp)),
      where(FDATE, '<=', Timestamp.fromMillis(endDateTimestamp)),
      where('PAY_MODE', '==', selectedPaymentType)
    );

    const snapshot: Query<DocumentData> = query(
      collection1,
      where(FDATE, '>=', Timestamp.fromMillis(startDateTimestamp)),
      where(FDATE, '<=', Timestamp.fromMillis(endDateTimestamp))
    );

    const fetchBillData: QuerySnapshot<DocumentData> = await getDocs(
      selectedPaymentType !== 'All' ? snapshotCash : snapshot
    );

    const billData: BillData[] = fetchBillData.docs.map((doc) => doc.data());

    const snapshot2SubGroup: Query<DocumentData> = query(
      collection2,
      where(FDATE, '>=', Timestamp.fromMillis(startDateTimestamp)),
      where(FDATE, '<=', Timestamp.fromMillis(endDateTimestamp)),
      where('SGroupDesc', '==', selectedSubGroup)
    );

    const snapshot2: Query<DocumentData> = query(
      collection2,
      where(FDATE, '>=', Timestamp.fromMillis(startDateTimestamp)),
      where(FDATE, '<=', Timestamp.fromMillis(endDateTimestamp))
    );

    const fetchDetlData: QuerySnapshot<DocumentData> = await getDocs(
      selectedSubGroup !== 'ALL' && selectedSubGroup ? snapshot2SubGroup : snapshot2
    );

    const billDetData: BillDetailData[] = fetchDetlData.docs.map((doc) => doc.data());

    if (selectedSubGroup === 'ALL') {
      const uniqueSubgroups = Array.from(
        new Set(billDetData.map((product) => product.SGroupDesc).filter((desc): desc is string => !!desc))
      );
      setSubgroupsArray(uniqueSubgroups);
    }

    const combinedData: CombinedData[] = billData
      .map((bill) => {
        const matchingBillDet = billDetData.filter((billDet) => billDet[FNUMBER] === bill[FNUMBER]);

        // Include the item in combinedData only if there is at least one matching billDet
        if (matchingBillDet.length > 0) {
          return {
            BillNumber: bill[FNUMBER],
            customerDetails: bill,
            productsData: matchingBillDet,
          };
        }

        return null;
      })
      .filter((item): item is CombinedData => item !== null);

    return combinedData;
  } catch (error) {
    console.error('Error fetching data:', error);
    return undefined;
  }
};