"use client";
import React, { useState, useEffect, useContext } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase'; // Adjust path to your Firebase config
import { CounterContext } from '@/lib/CounterContext'; // Adjust path to your context
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

const ExportDataPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const { state } = useContext(CounterContext);

  const STATIC_PASSWORD = 'M1croace';

  // List of all collections provided
  const knownCollections = [
    'BILL',
    'BILLDET',
    'BILLIN',
    'BILLTERM',
    'BLINTERM',
    'BLLINDET',
    'CART',
    'Cards',
    'Customers',
    'DBNOTE',
    'DOCNUM',
    'GL_Mast',
    'Journals',
    'ORDER',
    'ORDERDET',
    'ORDERTERM',
    'PORDER',
    'PORDERDET',
    'PORDERTERM',
    'PRETDET',
    'PROMOCODES',
    'Payments',
    'Products',
    'SETTINGS',
    'SPLORDER',
    'Storemanagement',
    'TRNS1',
    'USERINPUTS',
  ];

  // Fetch Firestore collections
  const fetchCollections = async (tenantId: string) => {
    try {
      const validCollections: string[] = [];
      
      for (const coll of knownCollections) {
        const collRef = collection(db, `TenantsDb/${tenantId}/${coll}`);
        const snapshot = await getDocs(collRef);
        if (!snapshot.empty) {
          validCollections.push(coll);
        }
      }

      setCollections(validCollections.sort());
      if (validCollections.length > 0) {
        setSelectedCollection(validCollections[0]);
      }
      toast.success('Collections loaded successfully.');
    } catch (error) {
      console.error('Error fetching collections:', error);
      // toast.error('Failed to load collections.');
    }
  };

  // Export data to JSON or Excel
  const exportData = async (format: 'json' | 'excel') => {
    if (!state?.tenantId) {
      // toast.error('No tenant ID provided.');
      return;
    }

    if (!selectedCollection) {
      // toast.error('Please select a collection.');
      return;
    }

    setIsExporting(true);
    setProgress(0);

    try {
      const collRef = collection(db, `TenantsDb/${state.tenantId}/${selectedCollection}`);
      const snapshot = await getDocs(collRef);
      const totalDocs = snapshot.size;
      let processedDocs = 0;

      const data: any[] = [];
      
      // Simulate progress by incrementing per document
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
        processedDocs += 1;
        setProgress(Math.round((processedDocs / totalDocs) * 100));
      });

      if (format === 'json') {
        const jsonData = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedCollection}_export_${new Date().toISOString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Convert to Excel
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, selectedCollection);
        XLSX.writeFile(workbook, `${selectedCollection}_export_${new Date().toISOString()}.xlsx`);
      }

      toast.success(`Data exported successfully as ${format.toUpperCase()}.`);
    } catch (error) {
      console.error('Error exporting data:', error);
      // toast.error('Failed to export data.');
    } finally {
      setIsExporting(false);
      setProgress(100);
    }
  };

  useEffect(() => {
    if (state?.tenantId && isAuthenticated) {
      fetchCollections(state.tenantId);
    }
  }, [state?.tenantId, isAuthenticated]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === STATIC_PASSWORD) {
      setIsAuthenticated(true);
      toast.success('Authentication successful.');
    } else {
      // toast.error('Incorrect password.');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      {!isAuthenticated ? (
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Enter Password</h2>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
                placeholder="Enter password"
                disabled={isExporting}
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors duration-300 shadow-md hover:shadow-lg transform hover:scale-105 disabled:opacity-50"
              disabled={isExporting}
            >
              Submit
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-lg w-full">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Export Firestore Data</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Collection</label>
              <select
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
                disabled={isExporting}
              >
                {collections.length === 0 ? (
                  <option value="">No collections available</option>
                ) : (
                  collections.map((coll) => (
                    <option key={coll} value={coll}>
                      {coll}
                    </option>
                  ))
                )}
              </select>
            </div>
            {isExporting && (
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                >
                  <span className="text-xs font-medium text-white text-center block">{progress}%</span>
                </div>
              </div>
            )}
            <div className="flex space-x-4">
              <button
                onClick={() => exportData('json')}
                className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors duration-300 shadow-md hover:shadow-lg transform hover:scale-105 disabled:opacity-50"
                disabled={isExporting || !selectedCollection}
              >
                Export to JSON
              </button>
              <button
                onClick={() => exportData('excel')}
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors duration-300 shadow-md hover:shadow-lg transform hover:scale-105 disabled:opacity-50"
                disabled={isExporting || !selectedCollection}
              >
                Export to Excel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportDataPage;