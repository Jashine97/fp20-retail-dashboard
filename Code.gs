/***************************************************
 * FP20-style North America Retail Dashboard
 * HTML web app version (no Sheets charts)
 * Data + logic all in Code.gs
 ***************************************************/

// Global master lists (dimensions)
var FP20_REGIONS = ['West', 'East', 'Central', 'South'];
var FP20_STATES_BY_REGION = {
  'West':    ['California', 'Washington', 'Oregon', 'Nevada'],
  'East':    ['New York', 'Massachusetts', 'Virginia', 'Florida'],
  'Central': ['Texas', 'Illinois', 'Ohio', 'Michigan'],
  'South':   ['Georgia', 'North Carolina', 'Tennessee', 'Alabama']
};
var FP20_SEGMENTS = ['Consumer', 'Corporate', 'Home Office'];
var FP20_CATEGORIES = ['Technology', 'Furniture', 'Office Supplies'];
var FP20_SUBCATS = {
  'Technology':     ['Phones', 'Machines', 'Accessories', 'Copiers'],
  'Furniture':      ['Chairs', 'Tables', 'Bookcases', 'Furnishings'],
  'Office Supplies':['Storage', 'Binders', 'Appliances', 'Paper',
                     'Supplies', 'Art', 'Envelopes', 'Labels', 'Fasteners']
};
var FP20_SHIPMODES = ['Standard Class', 'Second Class', 'First Class', 'Same Day'];
var FP20_SALESPEOPLE = [
  'Anna Andreas', 'Chuck Maggee', 'Cassandra Brandow', 'Kelly Williams',
  'Sean Miller', 'Tamara Chang', 'Raymond Buch', 'Tom Ashbrook',
  'Adrian Barton', 'Ken Lonsdale'
];
var FP20_CUSTOMERS = [
  'Sean Miller', 'Tamara Chang', 'Raymond Buch', 'Tom Ashbrook',
  'Adrian Barton', 'Ken Lonsdale', 'Sanjit Chand', 'Hunter Lopez',
  'Sanjit Engle', 'Christopher Conant', 'Todd Sumrall', 'Greg Tran',
  'Becky Martin', 'Seth Vernon', 'Caroline Jumper', 'Kelly Williams',
  'Anna Andreas', 'Chuck Maggee', 'Cassandra Brandow'
];
var FP20_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Entry point for the web app.
 */
function doGet(e) {
  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle('North America Retail Supply Chain | Sales Analysis');
}

/**
 * Main API for the front-end.
 * filters: {year, region, segment, category, shipMode, salesPerson}
 */
function getDashboardData(filters) {
  filters = filters || {};
  var yearFilter   = filters.year        || 'All';
  var regionFilter = filters.region      || 'All';
  var segFilter    = filters.segment     || 'All';
  var catFilter    = filters.category    || 'All';
  var shipFilter   = filters.shipMode    || 'All';
  var salesFilter  = filters.salesPerson || 'All';

  var data = buildSampleDataArray_(); // in-memory dataset

  // if "All", show 2017 as current year (like the PBIX)
  var currentYear = yearFilter === 'All' ? 2017 : Number(yearFilter);
  var lyYear      = currentYear - 1;

  // Aggregation containers
  var revenueTotal = 0, costTotal = 0, profitTotal = 0;
  var orderCount = 0, qtyTotal = 0, totalDelDays = 0, returnCount = 0;

  var monthCurr = {}, monthLy = {};
  FP20_MONTHS.forEach(function(m){ monthCurr[m]=0; monthLy[m]=0; });

  var subcatTotals = {};
  var regionTotals = {};
  var segmentTotals = {};
  var categoryTotals = {};
  var shipModeTotals = {};
  var shipModeDelDays = {};
  var shipModeCounts = {};
  var customerTotals = {};
  var stateTotals = {};

  data.forEach(function(rec) {
    var yr = rec.year;

    // Filters
    if (yearFilter   !== 'All' && yr         !== Number(yearFilter)) return;
    if (regionFilter !== 'All' && rec.region !== regionFilter)       return;
    if (segFilter    !== 'All' && rec.segment!== segFilter)          return;
    if (catFilter    !== 'All' && rec.category!== catFilter)         return;
    if (shipFilter   !== 'All' && rec.shipMode!== shipFilter)        return;
    if (salesFilter  !== 'All' && rec.salesPerson!== salesFilter)    return;

    var monthName = rec.month;
    var rev       = rec.revenue;
    var cst       = rec.cost;
    var prf       = rec.profit;
    var q         = rec.quantity;
    var del       = rec.deliveryDays;
    var returned  = rec.returned;
    var state     = rec.state;
    var customer  = rec.customer;

    revenueTotal += rev;
    costTotal    += cst;
    profitTotal  += prf;
    qtyTotal     += q;
    totalDelDays += del;
    orderCount++;
    if (returned) returnCount++;

    if (yr === currentYear && monthCurr.hasOwnProperty(monthName)) {
      monthCurr[monthName] += rev;
    }
    if (yr === lyYear && monthLy.hasOwnProperty(monthName)) {
      monthLy[monthName] += rev;
    }

    addToMap_(subcatTotals, rec.subcategory, rev);
    addToMap_(regionTotals, rec.region, rev);
    addToMap_(segmentTotals, rec.segment, rev);
    addToMap_(categoryTotals, rec.category, rev);
    addToMap_(customerTotals, customer, rev);
    addToMap_(stateTotals, state, rev);

    addToMap_(shipModeTotals, rec.shipMode, rev);
    addToMap_(shipModeDelDays, rec.shipMode, del);
    addToMap_(shipModeCounts, rec.shipMode, 1);
  });

  var avgDel   = orderCount ? totalDelDays / orderCount : 0;
  var goodRate = orderCount ? (orderCount - returnCount) / orderCount : 0;

  // Build series arrays -------------------------------------------------

  var monthSeries = FP20_MONTHS.map(function(m) {
    return {
      month: m,
      current: monthCurr[m] || 0,
      last:    monthLy[m]  || 0
    };
  });

  var subcatSeries   = mapToSortedArray_(subcatTotals, 'subcategory');
  var regionSeries   = mapToSortedArray_(regionTotals, 'name');
  var segmentSeries  = mapToSortedArray_(segmentTotals, 'name');
  var categorySeries = mapToSortedArray_(categoryTotals, 'name');

  var shipSeries = [];
  Object.keys(shipModeTotals).forEach(function(k) {
    var avgDays = shipModeCounts[k] ? shipModeDelDays[k] / shipModeCounts[k] : 0;
    shipSeries.push({
      shipMode: k,
      revenue: shipModeTotals[k],
      avgDeliveryDays: avgDays
    });
  });
  shipSeries.sort(function(a,b){ return b.revenue - a.revenue; });

  var customerSeries = mapToSortedArray_(customerTotals, 'customer')
                        .slice(0,15); // top 15
  var stateSeries    = mapToSortedArray_(stateTotals, 'state')
                        .slice(0,10); // top 10

  // KPI object
  var kpis = {
    revenue: revenueTotal,
    cost:    costTotal,
    profit:  profitTotal,
    orders:  orderCount,
    quantity: qtyTotal,
    deliveryRate: goodRate,     // % non-return
    avgDeliveryDays: avgDel
  };

  // Dropdown members (for front-end)
  var filterOptions = {
    years:   [2014,2015,2016,2017],
    regions: ['All'].concat(FP20_REGIONS),
    segments:['All'].concat(FP20_SEGMENTS),
    categories:['All'].concat(FP20_CATEGORIES),
    shipModes:['All'].concat(FP20_SHIPMODES),
    salesPeople:['All'].concat(FP20_SALESPEOPLE)
  };

  return {
    kpis: kpis,
    series: {
      months: monthSeries,
      subcategories: subcatSeries,
      regions: regionSeries,
      segments: segmentSeries,
      categories: categorySeries,
      shipModes: shipSeries,
      customers: customerSeries,
      states: stateSeries
    },
    filterOptions: filterOptions,
    appliedFilters: {
      year: yearFilter,
      region: regionFilter,
      segment: segFilter,
      category: catFilter,
      shipMode: shipFilter,
      salesPerson: salesFilter
    }
  };
}

/**
 * Build a sample dataset in memory.
 * Returns array of objects.
 */
function buildSampleDataArray_() {
  var recs = [];
  var numRows = 800;

  for (var i = 0; i < numRows; i++) {
    var year = 2014 + Math.floor(Math.random() * 4); // 2014–2017
    var mIdx = Math.floor(Math.random() * 12);
    var monthName = FP20_MONTHS[mIdx];

    var region = pick_(FP20_REGIONS);
    var state  = pick_(FP20_STATES_BY_REGION[region]);

    var customer = pick_(FP20_CUSTOMERS);
    var segment  = pick_(FP20_SEGMENTS);
    var category = pick_(FP20_CATEGORIES);
    var subcat   = pick_(FP20_SUBCATS[category]);
    var shipMode = pick_(FP20_SHIPMODES);
    var sales    = pick_(FP20_SALESPEOPLE);

    var quantity = 1 + Math.floor(Math.random() * 8);
    var basePrice = 50 + Math.random() * 450;
    var revenue = round2_(basePrice * quantity);
    var cost    = round2_(revenue * (0.65 + Math.random() * 0.15));
    var profit  = round2_(revenue - cost);
    var deliveryDays = 1 + Math.floor(Math.random() * 7);
    var returned = Math.random() < 0.08; // 8% returns

    recs.push({
      year: year,
      month: monthName,
      region: region,
      state: state,
      customer: customer,
      segment: segment,
      category: category,
      subcategory: subcat,
      shipMode: shipMode,
      salesPerson: sales,
      revenue: revenue,
      cost: cost,
      profit: profit,
      quantity: quantity,
      deliveryDays: deliveryDays,
      returned: returned
    });
  }
  return recs;
}

// ---------- Small helpers ----------
function pick_(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function round2_(n) {
  return Math.round(n * 100) / 100;
}
function addToMap_(map, key, val) {
  map[key] = (map[key] || 0) + val;
}
function mapToSortedArray_(map, labelKeyName) {
  var arr = [];
  Object.keys(map).forEach(function(k) {
    arr.push({ label: k, value: map[k] });
  });
  arr.sort(function(a,b){ return b.value - a.value; });
  // convert to nice shape for client
  return arr.map(function(o) {
    var obj = {};
    obj[labelKeyName] = o.label;
    obj.value = o.value;
    return obj;
  });
}
