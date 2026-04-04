export const VENDORS = [
  { id: 'amazon',   name: 'Amazon.de',  color: '#F90',     minOrder: 0,  leadDays: 2 },
  { id: 'luxcaddy', name: 'Luxcaddy',   color: '#1D9E75',  minOrder: 30, leadDays: 2 },
  { id: 'efarmz',   name: 'efarmz.be',  color: '#3B6D11',  minOrder: 35, leadDays: 3 },
  { id: 'naturata', name: 'Naturata',   color: '#854F0B',  minOrder: 0,  leadDays: 5 },
  { id: 'biobus',   name: 'Biobus.de',  color: '#185FA5',  minOrder: 0,  leadDays: 4 },
  { id: 'cactus',   name: 'Cactus',     color: '#E24B4A',  minOrder: 0,  leadDays: 1 },
];

export const CATEGORIES = [
  'Pantry', 'Fridge', 'Cleaning', 'Personal Care',
  'Baby & Kids', 'Beverages', 'Snacks', 'Other',
];

export const UNITS = ['pc', 'kg', 'g', 'L', 'ml', 'pack'];

export const SEED_PRODUCTS = [
  { id: 'p1', name: 'Whole Milk',       cat: 'Fridge',     unit: 'L',    minQty: 2,   currentQty: 1.5, vendor: 'cactus',   burnRate: 0.5,  note: '' },
  { id: 'p2', name: 'Olive Oil (500ml)',cat: 'Pantry',     unit: 'pc',   minQty: 1,   currentQty: 3,   vendor: 'amazon',   burnRate: 0.05, note: '' },
  { id: 'p3', name: 'Dishwasher Tabs',  cat: 'Cleaning',   unit: 'pc',   minQty: 10,  currentQty: 4,   vendor: 'amazon',   burnRate: 1,    note: '' },
  { id: 'p4', name: 'Greek Yogurt',     cat: 'Fridge',     unit: 'pc',   minQty: 3,   currentQty: 6,   vendor: 'luxcaddy', burnRate: 0.7,  note: '' },
  { id: 'p5', name: 'Oat Flour',        cat: 'Pantry',     unit: 'kg',   minQty: 0.5, currentQty: 0.2, vendor: 'efarmz',   burnRate: 0.05, note: '' },
  { id: 'p6', name: 'Baby Wipes',       cat: 'Baby & Kids',unit: 'pack', minQty: 2,   currentQty: 5,   vendor: 'amazon',   burnRate: 0.3,  note: '' },
  { id: 'p7', name: 'Sparkling Water',  cat: 'Beverages',  unit: 'L',    minQty: 6,   currentQty: 2,   vendor: 'cactus',   burnRate: 1.2,  note: '' },
  { id: 'p8', name: 'Oat Milk',         cat: 'Beverages',  unit: 'L',    minQty: 2,   currentQty: 4,   vendor: 'biobus',   burnRate: 0.4,  note: '' },
];
