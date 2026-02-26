# **App Name**: ControlMax Inventory

## Core Features:

- User Authentication: Secure user authentication using Firebase Auth with email/password.
- Inventory CRUD: Create, read, update, and delete inventory items with fields: name, dailySales, currentStock, minStock, maxStock, category, observations, and updatedAt.
- Real-time Data: Utilize Firestore to store and retrieve data, ensuring real-time updates across devices.
- Automatic Status Calculation: Automatically determine product status based on stock levels (Repor Estoque, Estoque Suficiente, Excesso) using business logic.
- Dashboard Metrics: Display key metrics in stat cards: Total de Itens, Itens Críticos, and Valor em Estoque, to provide a quick overview of inventory status.
- Responsive Table: An interactive table to display, edit, and manage inventory items.

## Style Guidelines:

- Background: Light gray (#F8FAFC) to minimize eye strain (bg-slate-50).
- Surface: White cards with light shadow (#FFFFFF) and light gray border (#E5E7EB) (bg-white with shadow-sm and border-slate-200).
- Primary Action: Blue (#3B82F6) for buttons (bg-blue-600 hover:bg-blue-700).
- Text: Dark gray (#334155) primary and medium gray (#64748B) secondary (text-slate-800 and text-slate-500).
- Critical/Repor Status: Light red background with red text and border (#FEE2E2, #B91C1C, #FECACA) for currentStock <= minStock (bg-red-100 text-red-700 border-red-200).
- Normal Status: Light green background with green text and border (#ECFDF5, #065F46, #D1FAE5) for stable stock levels (bg-emerald-100 text-emerald-700 border-emerald-200).
- Excess Status: Light amber background with amber text and border (#FFFBEB, #A16207, #FEF3C7) for currentStock >= maxStock (bg-amber-100 text-amber-700 border-amber-200).
- Font: 'Inter', a sans-serif font for a clean and readable UI.
- Data Table: Full-width, left-aligned text, collapsed borders, hover effects, and uppercase header (w-full text-left border-collapse hover:bg-slate-50).
- Icons: Use Lucide-React or Heroicons for clear, simple iconography within buttons and UI elements.