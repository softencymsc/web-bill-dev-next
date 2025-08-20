 const pagesArray = [
  { key: '', label: 'Access the main dashboard for system overview' },
  { key: 'Master/Customer', label: 'Manage customer information and interactions' },
  { key: 'Master/Vendor', label: 'Handle vendor details and communications' },
  { key: 'Master/Product', label: 'Administer product catalog and inventory' },
  { key: 'Master/Ledger', label: 'View and manage financial ledgers' },
  { key: 'Sale/Order', label: 'Create and process sales orders' },
  { key: 'Sale/Bill', label: 'Generate and manage sales bills' },
  { key: 'Purchase/Order', label: 'Create and track purchase orders' },
  { key: 'Purchase/Bill', label: 'Manage purchase bills and payments' },
  { key: 'Voucher', label: 'Handle financial vouchers and transactions' },
  { key: 'report/sale/order', label: 'Access reports for sales orders' },
  { key: 'report/sale/invoice', label: 'View detailed sales bill reports' },
  { key: 'report/purchase/order', label: 'Access reports for purchase orders' },
  { key: 'report/purchase/bill', label: 'View detailed purchase bill reports' },
  { key: 'VoucherReport', label: 'Access financial voucher reports' },
  { key: 'OnlineIntegration', label: 'Manage online integration settings' },
  { key: 'StaffCreateEdit', label: 'Create and edit staff accounts' },
  { key: 'ProfileEdit', label: 'Edit personal profile information' },
]
const newArr = []
for (let i = 0; i < pagesArray.length; i++) {
    const key = pagesArray[i].key.toLowerCase()
    const label = pagesArray[i].label
    newArr.push({key:key,label:label})
}
const currencies = [
  { code: "$", name: "United States Dollar", currencyCode: "USD", subunit: "Cents" },
  { code: "₹", name: "Indian Rupee", currencyCode: "INR", subunit: "Paise" },
  { code: "€", name: "Euro", currencyCode: "EUR", subunit: "Cents" },
  { code: "£", name: "British Pound", currencyCode: "GBP", subunit: "Pence" },
  { code: "¥", name: "Japanese Yen", currencyCode: "JPY", subunit: null },
  { code: "A$", name: "Australian Dollar", currencyCode: "AUD", subunit: "Cents" },
  { code: "₨", name: "Nepalese Rupee", currencyCode: "NPR", subunit: "Paise" },
  { code: "C$", name: "Canadian Dollar", currencyCode: "CAD", subunit: "Cents" },
  { code: "¥", name: "Chinese Yuan", currencyCode: "CNY", subunit: "Fen" },
  { code: "R$", name: "Brazilian Real", currencyCode: "BRL", subunit: "Centavos" },
  { code: "CHF", name: "Swiss Franc", currencyCode: "CHF", subunit: "Rappen" },
  { code: "S$", name: "Singapore Dollar", currencyCode: "SGD", subunit: "Cents" },
  { code: "NZ$", name: "New Zealand Dollar", currencyCode: "NZD", subunit: "Cents" },
  { code: "₩", name: "South Korean Won", currencyCode: "KRW", subunit: null },
  { code: "MX$", name: "Mexican Peso", currencyCode: "MXN", subunit: "Centavos" },
  { code: "ZAR", name: "South African Rand", currencyCode: "ZAR", subunit: "Cents" },
  { code: "SEK", name: "Swedish Krona", currencyCode: "SEK", subunit: "Öre" },
  { code: "RUB", name: "Russian Rubles", currencyCode: "RUB", subunit: "Kopeks" },
];
export  {newArr, currencies}