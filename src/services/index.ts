/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  collection,
  addDoc,
  query,
  getDocs,
  where,
  orderBy,
  limit,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  setDoc,
  Query,
  CollectionReference,
  DocumentData,
  DocumentReference,
  QueryConstraint,
  QuerySnapshot,
  DocumentSnapshot,
  Firestore,
} from "firebase/firestore";
import { getAuth, signOut, User } from "firebase/auth";
import { collections } from "../config";
import { auth, db } from "../../firebase";

// Helper function to map Firestore document to a custom object based on fieldNamesToMap
function mapDocumentToCustomObject(
  doc: DocumentSnapshot<DocumentData>,
  fieldNamesToMap: string[]
): Record<string, any> {
  const data = doc.data() || {};
  const mapped: Record<string, any> = {};
  fieldNamesToMap.forEach((field) => {
    mapped[field] = data[field];
  });
  mapped.id = doc.id;
  return mapped;
}

// Existing Functions
export const fetchDataFromDb = async (
  sort: { field: string; direction: "asc" | "desc" }[] = [
    { field: "BILL_DATE", direction: "desc" },
  ],
  whereQuery: { field: string; operator: any; value: any }[] = [],
  ref: CollectionReference<DocumentData> | Query<DocumentData> | undefined,
  fieldNamesToMap?: string[]
): Promise<any[]> => {
  try {
    if (!ref) throw new Error("Collection reference is undefined");
    const queryConstraints: QueryConstraint[] = [];

    // Apply where queries if provided
    if (Array.isArray(whereQuery) && whereQuery.length > 0) {
      whereQuery.forEach(({ field, operator, value }) => {
        queryConstraints.push(where(field, operator, value));
      });
    }

    // Apply sorting if provided
    if (Array.isArray(sort) && sort.length > 0) {
      sort.forEach(({ field, direction }) => {
        queryConstraints.push(orderBy(field, direction));
      });
    }

    const q = query(ref, ...queryConstraints);
    const fetchData = await getDocs(q);

    if (fieldNamesToMap) {
      return fetchData.docs.map((doc) =>
        mapDocumentToCustomObject(doc, fieldNamesToMap)
      );
    } else {
      const results: any[] = [];
      fetchData.forEach((doc) => {
        const data = doc.data();
        data.id = doc.id;
        results.push(data);
      });
      return results;
    }
  } catch (error) {
    console.error("fetchDataFromDb error:", error);
    throw error;
  }
};

export const fetchDataWithMultipleWheree = async (
  ref: CollectionReference<DocumentData>,
  field1: string,
  data1: any,
  field2: string,
  data2: any
): Promise<any[] | null> => {
  const snapshot = query(
    ref,
    where(field1, "==", data1),
    where(field2, "==", data2)
  );
  const fetchData = await getDocs(snapshot);
  const results: any[] = [];

  fetchData.forEach((doc) => {
    const abc = { id: doc.id, ...doc.data() };
    results.push(abc);
  });

  return results.length > 0 ? results : null;
};

export const fetchDataWithSingleWheree = async (
  ref: CollectionReference<DocumentData>,
  field1: string,
  data1: any
): Promise<any[] | null> => {
  const snapshot = query(ref, where(field1, "==", data1));
  const fetchData = await getDocs(snapshot);
  const results: any[] = [];

  fetchData.forEach((doc) => {
    const abc = { id: doc.id, ...doc.data() };
    results.push(abc);
  });

  return results.length > 0 ? results : null;
};

export const fetchDataWithQuery = async (
  queryObj: Query<DocumentData>
): Promise<any[]> => {
  try {
    const querySnapshot = await getDocs(queryObj);
    const data = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return data;
  } catch (error) {
    console.error("Error in fetchDataWithQuery:", error);
    throw error;
  }
};
export const fetchWhereNotEqual = async (
  collectionRef: CollectionReference<DocumentData>,
  field: string,
  value: any
): Promise<any[]> => {
  try {
    const q = query(collectionRef, where(field, "!=", value));
    const results = await fetchDataWithQuery(q);
    return results;
  } catch (error) {
    console.error("Error in fetchWhereNotEqual:", error);
    throw error;
  }
};
export const createData = async (
  collectionRef: CollectionReference<DocumentData>,
  data: Record<string, any>
) => {
  if (
    !collectionRef ||
    typeof collectionRef !== "object" ||
    !("firestore" in collectionRef) ||
    !("_path" in collectionRef)
  ) {
    console.error("Invalid collectionRef in createData:", collectionRef);
    throw new Error("Invalid collection reference in createData");
  }
  try {
    return await addDoc(collectionRef, data);
  } catch (error) {
    console.error("createData error:", error);
    throw error;
  }
};

export const deleteData = async (
  ref: CollectionReference<DocumentData>,
  id: string
) => {
  const qyr = doc(ref, id);
  try {
    await deleteDoc(qyr);
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};

export const deleteMultipleDocs = async (
  ref: CollectionReference<DocumentData>,
  field: string,
  value: any
) => {
  try {
    const ref1 = query(ref, where(field, "==", value));
    const querySnapshot = await getDocs(ref1);

    const deletePromises: Promise<void>[] = [];
    querySnapshot.forEach((doc) => {
      const deletePromise = deleteDoc(doc.ref);
      deletePromises.push(deletePromise);
    });

    await Promise.all(deletePromises);
  } catch (error) {
    console.error("Error deleting documents:", error);
    throw error;
  }
};

export const fetchDataWithWhere = async (
  ref: CollectionReference<DocumentData>,
  field: string,
  data: any
): Promise<any[]> => {
  const snapshot = query(ref, where(field, "==", data));
  const fetchData = await getDocs(snapshot);
  const results: any[] = [];
  fetchData.forEach((doc) => {
    const abc = { id: doc.id, ...doc.data() };
    results.push(abc);
  });
  return results;
};

export const fetchBillDataWithWhere = async (
  ref: CollectionReference<DocumentData>,
  field: string,
  data: any
): Promise<any[]> => {
  const snapshot = query(ref, where(field, "==", data));
  const fetchData = await getDocs(snapshot);
  const results: any[] = [];
  fetchData.forEach((doc) => {
    const abc = { id: doc.id, ref: doc.ref, ...doc.data() };
    results.push(abc);
  });
  return results;
};

export const getCount = async (
  ref: CollectionReference<DocumentData> | Query<DocumentData>
): Promise<number> => {
  const fetchData = await getDocs(ref);
  return fetchData.size;
};

export const formatFirestoreTimestamp = (timestamp: any): string | undefined => {
  if (timestamp) {
    const jsDate = new Date(
      timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000
    );
    const formattedDate = jsDate.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return formattedDate;
  }
};

export const fetchRefWithMultipleWhere = async (
  ref: CollectionReference<DocumentData>,
  field1: string,
  data1: any,
  field2: string,
  data2: any
): Promise<any[]> => {
  const snapshot = query(
    ref,
    where(field1, "==", data1),
    where(field2, "==", parseInt(data2))
  );
  const results: any[] = [];
  const fetchData = await getDocs(snapshot);
  fetchData.forEach((doc) => {
    const abc = { id: doc.id, ...doc.data() };
    results.push(abc);
  });
  return results;
};

export const updateDocWithWhere = async (
  ref: CollectionReference<DocumentData>,
  field1: string,
  data1: any,
  field2: string,
  data2: any,
  newData: Record<string, any>
): Promise<any | null> => {
  try {
    const prevData = await fetchDataWithMultipleWheree(
      ref,
      field1,
      data1,
      field2,
      data2
    );

    if (prevData && prevData.length > 0) {
      const docIdToUpdate = prevData[0].id;
      const updatedData = { ...prevData[0], ...newData };
      await deleteData(ref, docIdToUpdate);
      await createData(ref, updatedData);
      return updatedData;
    } else {
      return null;
    }
  } catch (error) {
    console.error("updateDocWithWhere error ->", error);
    throw error;
  }
};

export const updateDocWithSingleWhere = async (
  ref: CollectionReference<DocumentData>,
  field1: string,
  data1: any,
  newData: Record<string, any>
): Promise<any | null> => {
  try {
    const prevData = await fetchDataWithWhere(
      ref,
      field1,
      data1
    );

    if (prevData && prevData.length > 0) {
      const docIdToUpdate = prevData[0].id;
      const updatedData = { ...prevData[0], ...newData };
      await deleteData(ref, docIdToUpdate);
      await createData(ref, updatedData);
      return updatedData;
    } else {
      return null;
    }
  } catch (error) {
    console.error("updateDocWithWhere error ->", error);
    throw error;
  }
};

export const getLastCustCode = async (
  ref: CollectionReference<DocumentData>,
  type: string
): Promise<number> => {
  return fetchDataWithWhere(ref, "CUST_VEND", type).then((customers) => {
    if (customers) {
      const existingCustomerCodes = customers.map(
        (customer) => Number(customer.CUSTCODE)
      );
      const maxCustomerCode = Math.max(...existingCustomerCodes, 0);
      const nextCode = Number(1 + maxCustomerCode);
      return nextCode;
    } else {
      return 1;
    }
  });
};

export const isProductCodeUnique = async (
  ref: CollectionReference<DocumentData>,
  PRODCODE: string
): Promise<boolean> => {
  try {
    const querySnapshot = await getDocs(
      query(ref, where("PRODCODE", "==", PRODCODE))
    );
    return querySnapshot.empty;
  } catch (error) {
    console.error("Error checking product code uniqueness:", error);
    return false;
  }
};

export const isCustDelteable = async (
  ref: CollectionReference<DocumentData>,
  CUSTCODE: string
): Promise<boolean> => {
  try {
    const querySnapshot = await getDocs(
      query(ref, where("CUSTCODE", "==", CUSTCODE))
    );
    return querySnapshot.empty;
  } catch (error) {
    console.error("Error checking product code uniqueness:", error);
    return false;
  }
};

export const isExistsInRef = async (
  ref: CollectionReference<DocumentData>,
  field: string,
  id: any
): Promise<boolean> => {
  try {
    const querySnapshot = await getDocs(query(ref, where(field, "==", id)));
    return querySnapshot.empty;
  } catch (error) {
    console.error("Error checking product code uniqueness:", error);
    return false;
  }
};

export const isExistsInRefWithCustomQuery = async (queryProps: Query<DocumentData>) => {
  try {
    const querySnapshot = await getDocs(queryProps);
    return querySnapshot.empty;
  } catch (error) {
    console.error("Error checking product code uniqueness:", error);
    return false;
  }
};

export const isRefEmpty = async (ref: CollectionReference<DocumentData>) => {
  try {
    const querySnapshot = await getDocs(ref);
    return querySnapshot.empty;
  } catch (error) {
    console.error("Error checking product code uniqueness:", error);
    return false;
  }
};

const getUserTenantIdByEmail = async (email: string) => {
  const userRef = collection(db, collections.TENANTS);
  const q = query(userRef, where("email", "==", email));
  const fetchData = await getDocs(q);
  const results: any[] = [];
  fetchData.forEach((doc) => {
    const abc = { id: doc.id, ...doc.data() };
    results.push(abc);
  });
  if (results[0]) {
    const t = results;
    localStorage.setItem("tenant", JSON.stringify(t[0]));
    return results;
  } else {
    signOut(auth);
    return false;
  }
};

export const isAuthorizedRole = async (reqRole: string) => {
  const currentUser = auth.currentUser;

  if (!currentUser || !currentUser.email) {
    console.error("User is not authenticated or email is not available.");
    return false;
  }

  const email = currentUser.email;
  try {
    const tenant = await getUserTenantIdByEmail(email);
    if (Array.isArray(tenant) && tenant.length > 0) {
      const tenantRole = tenant[0].role;
      if (tenantRole === "ADMIN") {
        return true;
      } else if (tenantRole === reqRole) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
};

export const updateOrCreateData = async (
  ref: CollectionReference<DocumentData>,
  queryField: string,
  queryValue: any,
  data: Record<string, any>
) => {
  try {
    const snapshot = await getDocs(
      query(ref, where(queryField, "==", queryValue))
    );

    if (snapshot.docs.length > 0) {
      const docIdToUpdate = snapshot.docs[0].id;
      await updateDoc(doc(ref, docIdToUpdate), data);
      return docIdToUpdate;
    } else {
      const newDocRef = await addDoc(ref, data);
      return newDocRef.id;
    }
  } catch (error) {
    console.error("Error updating or creating document:", error);
    throw error;
  }
};

export const fetchLastDocumentByTimestamp = async (
  collectionRef: CollectionReference<DocumentData>,
  timestampField: string
) => {
  try {
    const querySnapshot = await getDocs(
      query(collectionRef, orderBy(timestampField, "desc"), limit(1))
    );

    if (!querySnapshot.empty) {
      const lastDocument = querySnapshot.docs[0].data();
      lastDocument.id = querySnapshot.docs[0].id;
      return lastDocument;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error fetching last document:", error);
    throw error;
  }
};

const generateTimeStamp = async () => {
  if (!auth.currentUser || !auth.currentUser.email) {
    throw new Error("User is not authenticated or email is not available.");
  }
  const tenant = await getUserTenantIdByEmail(auth.currentUser.email);
  const tenantId = Array.isArray(tenant) && tenant[0] ? tenant[0].tenant_id : undefined;
  const timestamp = Math.floor(Date.now() / 1000);
  const output = `${tenantId}-` + timestamp;
  return output;
};

const generateInvoiceNumber = (numberingDoc: any) => {
  const paddedNumber = numberingDoc.StartingNumber.padStart(
    numberingDoc.LetterCount -
      numberingDoc.Suffix.length -
      numberingDoc.Prefix.length,
    "0"
  );
  const sampleNumber = `${numberingDoc.Prefix}${paddedNumber}${numberingDoc.Suffix}`;
  return sampleNumber;
};

const extractSerialNumber = async (invoiceNumber: string, numberingDoc: any) => {
  if (invoiceNumber && numberingDoc) {
    const regex = new RegExp(
      `${numberingDoc.Prefix}(\\d+)${numberingDoc.Suffix}`
    );
    const match = invoiceNumber.match(regex);
    const newNumber = match ? parseInt(match[1], 10) + 1 : null;
    if (newNumber === null) {
      return await generateTimeStamp();
    }
    const paddedNumber = newNumber
      .toString()
      .padStart(
        numberingDoc.LetterCount -
          numberingDoc.Suffix.length -
          numberingDoc.Prefix.length,
        "0"
      );
    const sampleNumber = `${numberingDoc.Prefix}${paddedNumber}${numberingDoc.Suffix}`;
    return sampleNumber;
  } else if (numberingDoc) {
    return generateInvoiceNumber(numberingDoc);
  } else {
    return await generateTimeStamp();
  }
};
const allowedModels = [
  "Sale Bill",
  "Sale Order",
  "Purchase Bill",
  "Purchase Order",
  "Special Order",
  "Voucher",
  "Customer",
  "Vendor"
];


// Updateing the prifix and suffix of the numbering document
export const updateModelPrefix = async (
  tenantId: string,
  model: string,
  newPrefix: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!allowedModels.includes(model)) {
      throw new Error(`Model "${model}" is not supported.`);
    }

    const modelRef = doc(db, "TenantsDb", tenantId, "DOCNUM", model);

    await setDoc(modelRef, { PREFIX: `${newPrefix}` }, { merge: true });

    return { success: true };
  } catch (err: any) {
    console.error("❌ Failed to update prefix:", err.message);
    return { success: false, error: err.message };
  }
};

export const getNextNumberWithSuffixPrefix = async (
  docNumRef: CollectionReference<DocumentData>,
  modelName: string,
  lastInvoiceRef: CollectionReference<DocumentData>,
  timestampField: string,
  invField: string
) => {
  const numberingDoc = await fetchDataWithWhere(
    docNumRef,
    "DocType",
    modelName
  );
  const lastDoc = await fetchLastDocumentByTimestamp(
    lastInvoiceRef,
    timestampField
  );
  const data = {
    numberingDoc: numberingDoc[0] || "",
    lastDoc: lastDoc ? lastDoc[invField] : "",
  };
  const extractedSerialNumber = await extractSerialNumber(
    data.lastDoc,
    data.numberingDoc
  );
  return extractedSerialNumber;
};

//Get the prefix of specific model 

export const getPrefixForModel = async (
  tenantId: string,
  model: string
): Promise<string> => {
  if (!allowedModels.includes(model)) {
    throw new Error(`❌ Invalid model: ${model}`);
  }

  const docRef = doc(db, "TenantsDb", tenantId, "DOCNUM", model);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error(`❌ Prefix for "${model}" not found in DB`);
  }

  const data = docSnap.data();
  const prefix = data?.PREFIX;

  if (!prefix) {
    throw new Error(`❌ PREFIX field missing for model "${model}"`);
  }

  return prefix;
};
export const getCompanyDetailsByTenantId = async (tenantId: string) => {
  const tenantDocumentRef = doc(db, collections.TENANTSDB, tenantId);

  try {
    const tenantDocumentSnapshot = await getDoc(tenantDocumentRef);

    if (tenantDocumentSnapshot.exists()) {
      const companyData = tenantDocumentSnapshot.data();
      return companyData;
    } else {
      return null;
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error getting document:", error.message);
    } else {
      console.error("Error getting document:", error);
    }
    throw error;
  }
};

export const updateCompanyDetails = async (tenantId: string, newData: Record<string, any>) => {
  const tenantDocumentRef = doc(db, collections.TENANTSDB, tenantId);

  try {
    await updateDoc(tenantDocumentRef, newData);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error updating company details:", error.message);
    } else {
      console.error("Error updating company details:", error);
    }
    throw error;
  }
};

export const adminCollection = async (cname: string) => {
  const tenantsCollection = collection(db, "Tnb");
  if (cname) {
    const tenantDocRef = doc(tenantsCollection, "collections");
    const ref = collection(tenantDocRef, cname);
    return ref;
  } else {
    console.error("Invalid tenant ID or collection name");
    return null;
  }
};

export const createDataWithId = async (ref: CollectionReference<DocumentData>, docId: string, data: Record<string, any>) => {
  try {
    await setDoc(doc(ref, docId), { ...data });
  } catch (error) {
    throw error;
  }
};

export const multiEntry = async (entries: { collectionRef: CollectionReference<DocumentData>; data: Record<string, any> }[]) => {
  try {
    const promises = entries.map(async (entry, index) => {
      const { collectionRef, data } = entry;
      if (!collectionRef || typeof collectionRef !== "object" || !collectionRef.firestore || !collectionRef.path) {
        console.error(`Invalid collectionRef at index ${index}:`, collectionRef);
        throw new Error(`Invalid collection reference at index ${index}: ${collectionRef?.path || "undefined"}`);
      }
      return createData(collectionRef, data);
    });
    await Promise.all(promises);
  } catch (error) {
    console.error("multiEntry error:", error);
    throw error;
  }
};

export const updateDocument = async (collectionPath: string, docId: string, data: Record<string, any>) => {
  if (!collectionPath || !docId) {
    throw new Error("updateDocument: collectionPath or docId is undefined");
  }
  const docRef = doc(db, collectionPath, docId);
  await updateDoc(docRef, data);
};