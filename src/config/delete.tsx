"use client";

import { doc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase'; // Your Firebase config

async function deleteById(id: number | string, coll: string) {
  let collections: { name: string; field: string }[] = [];
  const collLower = coll.toLowerCase();

  console.log('coll:', collLower,id);

  // Fetch tenant JSON string from localStorage
  const tenantString = localStorage.getItem('tenant');

  // Validate tenant string
  if (!tenantString) {
    console.error('tenant not found in localStorage');
    return;
  }

  // Parse tenant JSON
  let tenant;
  try {
    tenant = JSON.parse(tenantString);
  } catch (error) {
    console.error('Error parsing tenant JSON from localStorage:', error);
    return;
  }

  // Validate tenant object and tenant_id
  if (!tenant || typeof tenant !== 'object' || !tenant.tenant_id || typeof tenant.tenant_id !== 'string') {
    console.error('Invalid tenant object or missing tenant_id in localStorage');
    return;
  }

  const tenantId = tenant.tenant_id;

  switch (collLower) {
    case 'customer':
      collections = [{ name: 'Customers', field: 'CUSTCODE' }];
      break;
    case 'agent':
      collections = [{ name: 'AGENTS', field: 'AGENTCODE' }];
      break;
    case 'vendor':
      collections = [{ name: 'Customers', field: 'CUSTCODE' }];
      break;
    case 'product':
      collections = [{ name: 'Products', field: 'PRODCODE' }];
      break;
    case 'ledger':
      collections = [{ name: 'GL_Mast', field: 'GLCODE' }];
      break;
    case 'purchase/special':
      collections = [{ name: 'SPLORDER', field: 'BILL_NO' }];
      break;
    case 'voucher':
      collections = [{ name: 'TRNS1', field: 'TRNNO' }];
      break;
    case 'sale order':
      collections = [
        { name: 'ORDER', field: 'OA_NO' },
        { name: 'ORDERDET', field: 'OA_NO' },
        { name: 'ORDERTERM', field: 'OA_NO' },
      ];
      break;
    case 'sale bill':
      collections = [
        { name: 'BILL', field: 'BILL_NO' },
        { name: 'BILLDET', field: 'BILL_NO' },
        { name: 'BILLTERM', field: 'BILL_NO' },
      ];
      break;
    case 'purchase bill':
      collections = [
        { name: 'BILLIN', field: 'BILL_NO' },
        { name: 'BLLINDET', field: 'BILL_NO' },
        { name: 'BLINTERM', field: 'BILL_NO' },
      ];
      break;
    case 'purchase order':
      collections = [
        { name: 'PORDER', field: 'BILL_NO' },
        { name: 'PORDERDET', field: 'OA_NO' },
        { name: 'PORDERTERM', field: 'BILL_NO' },
      ];
    case 'entry/journal':
      collections = [{ name: 'TRNS1', field: 'JOURNAL_NO' }];
      break;
    case 'staff':
      collections = [{ name: 'STAFF', field: 'staffId' }];
      break;
    default:
      collections = [];
      break;
  }

  console.log('deleteById called with:', { id, coll, collections, tenantId }, { idType: typeof id, collType: typeof coll });

  try {
    if (!id || !collections.length) {
      console.error('ID and valid collection name(s) must be provided');
      return;
    }
    if (typeof id !== 'string' && typeof id !== 'number') {
      console.error('ID must be a string or number');
      return;
    }
    if (typeof coll !== 'string') {
      console.error('Collection name must be a string');
      return;
    }

    // Helper function to delete documents from a single collection
    const deleteFromCollection = async (collName: string, field: string) => {
      const targetRef = collection(db, 'TenantsDb', tenantId, collName);
      const q = query(targetRef, where(field, '==', id));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.log(`No matching documents found in ${collName}`);
        return false;
      }

      for (const document of querySnapshot.docs) {
        await deleteDoc(doc(db, 'TenantsDb', tenantId, collName, document.id));
        console.log(`Document with ID ${document.id} deleted successfully from ${collName} with ${field} = ${id}`);
      }
      return true;
    };

    // Delete documents from all specified collections
    let deleted = false;
    for (const { name, field } of collections) {
      const result = await deleteFromCollection(name, field);
      if (result) deleted = true;
    }

    if (deleted) {
      return id;
    } else {
      console.log('No documents were deleted');
      return;
    }
  } catch (error) {
    console.error('Error deleting document(s):', error);
  }
}

export default deleteById;