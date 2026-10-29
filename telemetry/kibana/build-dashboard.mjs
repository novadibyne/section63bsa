// Builds the Kibana saved objects for the "Legal Sakshya usage" dashboard (a data view, visualizations, a map and
// the dashboard) as NDJSON, for Stack Management → Saved objects → Import.
//
//   node telemetry/kibana/build-dashboard.mjs > telemetry/kibana/legal-sakshya-dashboard.ndjson
//
// Field names are those the Elastic Managed OTLP endpoint gives the worker's data: resource attributes under
// resource.attributes.*, log attributes under attributes.*, the visitor's location as the geo_point
// resource.attributes.client.geo.location.

const DATA_VIEW = 'legal-sakshya-usage';
const IP = 'resource.attributes.client.address';
const COUNTRY = 'resource.attributes.client.geo.country_iso_code';
const REGION = 'resource.attributes.client.geo.region_name';
const CITY = 'resource.attributes.client.geo.city_name';
const LOCATION = 'resource.attributes.client.geo.location';
const EVENT = 'attributes.event.name';
const HOUR = 'visit.hour_ist';
const WEEKDAY = 'visit.weekday_ist';
const WEEKDAY_NUMBER = 'visit.weekday_number_ist';

const kql = (query) => ({ query, language: 'kuery' });
const PAGE_VIEW = kql(`${EVENT} : "page_view"`);
const PDF = kql(`${EVENT} : "pdf_generated"`);

/* Lens columns */
const uniqueIps = (label = 'Unique IP addresses') => ({
  label, customLabel: true, dataType: 'number', operationType: 'unique_count', scale: 'ratio', sourceField: IP, isBucketed: false, params: { emptyAsNull: false },
});
const count = (label, filter) => ({
  label, customLabel: true, dataType: 'number', operationType: 'count', scale: 'ratio', sourceField: '___records___', isBucketed: false,
  ...(filter ? { filter } : {}), params: { emptyAsNull: false },
});
const terms = (label, field, size, orderBy, direction = 'desc', extra = {}) => ({
  label, customLabel: true, dataType: 'string', operationType: 'terms', scale: 'ordinal', sourceField: field, isBucketed: true,
  params: {
    size, orderBy, orderDirection: direction, otherBucket: false, missingBucket: false, parentFormat: { id: 'terms' },
    include: [], exclude: [], includeIsRegex: false, excludeIsRegex: false, ...extra,
  },
});
const lastValue = (label, field) => ({
  label, customLabel: true, dataType: 'string', operationType: 'last_value', scale: 'ordinal', sourceField: field, isBucketed: false,
  params: { sortField: '@timestamp', showArrayValues: false },
});
const lastSeen = () => ({
  label: 'Last seen', customLabel: true, dataType: 'date', operationType: 'max', scale: 'ratio', sourceField: '@timestamp', isBucketed: false, params: { emptyAsNull: true },
});
const perDay = () => ({
  label: 'Day', customLabel: true, dataType: 'date', operationType: 'date_histogram', scale: 'interval', sourceField: '@timestamp', isBucketed: true,
  params: { interval: '1d', includeEmptyRows: true, dropPartials: false },
});

function lens(id, title, visualizationType, columns, visualization, description = '') {
  const layerId = 'layer1';
  return {
    type: 'lens',
    id,
    attributes: {
      title,
      description,
      visualizationType,
      state: {
        visualization: { layerId, layerType: 'data', ...visualization },
        query: kql(''),
        filters: [],
        datasourceStates: {
          formBased: { layers: { [layerId]: { columns, columnOrder: Object.keys(columns), incompleteColumns: {}, sampling: 1 } } },
          textBased: { layers: {} },
        },
        internalReferences: [],
        adHocDataViews: {},
      },
    },
    references: [{ type: 'index-pattern', id: DATA_VIEW, name: `indexpattern-datasource-layer-${layerId}` }],
  };
}

const metric = (id, title, column, extra = {}) => lens(id, title, 'lnsMetric', { value: column }, { metricAccessor: 'value', ...extra });

/* ───────── Saved objects ───────── */

// Hour of day and day of week in Indian time, for the heatmap.
const IST = "ZonedDateTime t = doc['@timestamp'].value.withZoneSameInstant(ZoneId.of('Asia/Kolkata'));";
const dataView = {
  type: 'index-pattern',
  id: DATA_VIEW,
  attributes: {
    title: 'logs-legal_sakshya.otel-*',
    name: 'Legal Sakshya usage',
    timeFieldName: '@timestamp',
    allowNoIndex: true,
    runtimeFieldMap: JSON.stringify({
      // 0 to 23.
      [HOUR]: { type: 'long', script: { source: `${IST} emit(t.getHour());` } },
      [WEEKDAY]: {
        type: 'keyword',
        script: { source: `${IST} String[] d = new String[] {'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'}; emit(d[t.getDayOfWeek().getValue() - 1]);` },
      },
      // 1 (Monday) to 7 (Sunday), to keep the days in order.
      [WEEKDAY_NUMBER]: { type: 'long', script: { source: `${IST} emit(t.getDayOfWeek().getValue());` } },
    }),
    // Short dates, e.g. "29 Oct, 21:40" (in the viewer's time zone).
    fieldFormatMap: JSON.stringify({ '@timestamp': { id: 'date', params: { pattern: 'D MMM, HH:mm' } } }),
    fieldAttrs: JSON.stringify({
      [IP]: { customLabel: 'IP address' },
      [COUNTRY]: { customLabel: 'Country' },
      [REGION]: { customLabel: 'State / region' },
      [CITY]: { customLabel: 'City' },
      [LOCATION]: { customLabel: 'Location' },
      [EVENT]: { customLabel: 'Event' },
      [HOUR]: { customLabel: 'Hour (IST)' },
      [WEEKDAY]: { customLabel: 'Day (IST)' },
      [WEEKDAY_NUMBER]: { customLabel: 'Day number (IST)' },
    }),
    fields: '[]',
  },
  references: [],
};

const panels = [
  metric('legal-sakshya-unique-ips', 'Unique IP addresses', uniqueIps()),
  metric('legal-sakshya-visits', 'Visits', count('Visits (pages opened)', PAGE_VIEW)),
  metric('legal-sakshya-pdfs', 'PDFs made', count('PDF certificates made', PDF)),
  lens(
    'legal-sakshya-ip-table',
    'Visitors by IP address',
    'lnsDatatable',
    {
      ip: terms('IP address', IP, 500, { type: 'column', columnId: 'visits' }),
      country: lastValue('Country', COUNTRY),
      city: lastValue('City', CITY),
      visits: count('Visits', PAGE_VIEW),
      pdfs: count('PDFs', PDF),
      seen: lastSeen(),
    },
    {
      // IPv6 addresses (common on Indian mobile networks) wrap onto a second line.
      columns: [['ip', 200], ['country', 72], ['city', 110], ['visits', 66], ['pdfs', 52], ['seen', 115]].map(([columnId, width]) => ({ columnId, width, isTransposed: false })),
      sorting: { columnId: 'visits', direction: 'desc' },
      paging: { size: 20, enabled: true },
      rowHeight: 'auto',
      headerRowHeight: 'single',
    },
    'Each public IP address, where it is, how many pages it opened and PDFs it made, and when it was last seen.',
  ),
  lens(
    'legal-sakshya-heatmap',
    'When people visit (Indian time)',
    'lnsHeatmap',
    {
      // Days first: the heatmap lists rows in the order the days come back (Monday to Sunday).
      day: terms('Day (IST)', WEEKDAY, 7, { type: 'custom' }, 'asc', {
        orderAgg: { label: 'Day number', dataType: 'number', operationType: 'min', scale: 'ratio', sourceField: WEEKDAY_NUMBER, isBucketed: false, params: { emptyAsNull: true } },
      }),
      hour: {
        label: 'Hour (IST)', customLabel: true, dataType: 'number', operationType: 'range', scale: 'interval', sourceField: HOUR, isBucketed: true,
        // Every day gets every hour, empty ones too, so newer Kibanas (which list hours in the order they come back)
        // also show them in order.
        params: { type: 'histogram', ranges: [{ from: 0, to: 1000, label: '' }], maxBars: 24, includeEmptyRows: true },
      },
      visits: { ...count('Visits', PAGE_VIEW), params: { emptyAsNull: true } },
    },
    {
      shape: 'heatmap',
      xAccessor: 'hour',
      yAccessor: 'day',
      valueAccessor: 'visits',
      legend: { isVisible: true, position: 'right', type: 'heatmap_legend' },
      gridConfig: {
        type: 'heatmap_grid', isCellLabelVisible: true, isYAxisLabelVisible: true, isXAxisLabelVisible: true, isYAxisTitleVisible: false, isXAxisTitleVisible: true,
      },
    },
  ),
  lens(
    'legal-sakshya-countries',
    'Visitors by country',
    'lnsXY',
    { country: terms('Country', COUNTRY, 15, { type: 'column', columnId: 'ips' }), ips: uniqueIps('Unique IP addresses') },
    {
      preferredSeriesType: 'bar_horizontal',
      legend: { isVisible: false, position: 'right' },
      valueLabels: 'show',
      layers: [{ layerId: 'layer1', layerType: 'data', seriesType: 'bar_horizontal', xAccessor: 'country', accessors: ['ips'] }],
      axisTitlesVisibilitySettings: { x: false, yLeft: false, yRight: false },
    },
  ),
  lens(
    'legal-sakshya-states',
    'Visitors by state / region',
    'lnsXY',
    { region: terms('State / region', REGION, 15, { type: 'column', columnId: 'ips' }), ips: uniqueIps('Unique IP addresses') },
    {
      preferredSeriesType: 'bar_horizontal',
      legend: { isVisible: false, position: 'right' },
      valueLabels: 'show',
      layers: [{ layerId: 'layer1', layerType: 'data', seriesType: 'bar_horizontal', xAccessor: 'region', accessors: ['ips'] }],
      axisTitlesVisibilitySettings: { x: false, yLeft: false, yRight: false },
    },
  ),
  lens(
    'legal-sakshya-per-day',
    'Visits and unique IPs per day',
    'lnsXY',
    { day: perDay(), visits: count('Visits', PAGE_VIEW), ips: uniqueIps('Unique IP addresses') },
    {
      preferredSeriesType: 'line',
      legend: { isVisible: true, position: 'bottom' },
      valueLabels: 'hide',
      layers: [{ layerId: 'layer1', layerType: 'data', seriesType: 'line', xAccessor: 'day', accessors: ['visits', 'ips'] }],
      axisTitlesVisibilitySettings: { x: false, yLeft: false, yRight: false },
    },
  ),
];

const sizeByIps = { name: `cardinality_of_${IP}`, origin: 'source' };
const map = {
  type: 'map',
  id: 'legal-sakshya-map',
  attributes: {
    title: 'Where visitors are',
    description: 'Heat map of visitor locations, and circles sized by the number of unique IP addresses in each place.',
    mapStateJSON: JSON.stringify({
      zoom: 3.6,
      center: { lon: 79.5, lat: 22 },
      timeFilters: { from: 'now-30d', to: 'now' },
      refreshConfig: { isPaused: true, interval: 0 },
      query: kql(''),
      filters: [],
      settings: { autoFitToDataBounds: false, initialLocation: 'LAST_SAVED_LOCATION' },
    }),
    layerListJSON: JSON.stringify([
      {
        id: 'basemap',
        type: 'EMS_VECTOR_TILE',
        label: null,
        minZoom: 0, maxZoom: 24, alpha: 1, visible: true, includeInFitToBounds: true,
        sourceDescriptor: { type: 'EMS_TMS', isAutoSelect: true, lightModeDefault: 'road_map_desaturated' },
        style: { type: 'EMS_VECTOR_TILE', color: '' },
      },
      {
        id: 'heat',
        type: 'HEATMAP',
        label: 'Visitor heat map',
        minZoom: 0, maxZoom: 24, alpha: 0.75, visible: true, includeInFitToBounds: true,
        sourceDescriptor: {
          type: 'ES_GEO_GRID', id: 'heat-source', geoField: LOCATION, requestType: 'heatmap', resolution: 'FINE',
          metrics: [{ type: 'count' }], indexPatternRefName: 'layer_1_source_index_pattern',
          applyGlobalQuery: true, applyGlobalTime: true, applyForceRefresh: true,
        },
        style: { type: 'HEATMAP', colorRampName: 'theclassic' },
      },
      {
        id: 'places',
        type: 'GEOJSON_VECTOR',
        label: 'Unique IP addresses by place',
        minZoom: 0, maxZoom: 24, alpha: 0.85, visible: true, includeInFitToBounds: true,
        sourceDescriptor: {
          type: 'ES_GEO_GRID', id: 'places-source', geoField: LOCATION, requestType: 'point', resolution: 'COARSE',
          metrics: [{ type: 'cardinality', field: IP, label: 'Unique IP addresses' }, { type: 'count', label: 'Events' }],
          indexPatternRefName: 'layer_2_source_index_pattern',
          applyGlobalQuery: true, applyGlobalTime: true, applyForceRefresh: true,
        },
        style: {
          type: 'VECTOR',
          isTimeAware: true,
          properties: {
            icon: { type: 'STATIC', options: { value: 'marker' } },
            fillColor: { type: 'STATIC', options: { color: '#CA8EAE' } },
            lineColor: { type: 'STATIC', options: { color: '#FFFFFF' } },
            lineWidth: { type: 'STATIC', options: { size: 1 } },
            iconSize: { type: 'DYNAMIC', options: { minSize: 8, maxSize: 30, field: sizeByIps, fieldMetaOptions: { isEnabled: true, sigma: 3 } } },
            iconOrientation: { type: 'STATIC', options: { orientation: 0 } },
            labelText: { type: 'DYNAMIC', options: { field: sizeByIps } },
            labelColor: { type: 'STATIC', options: { color: '#000000' } },
            labelSize: { type: 'STATIC', options: { size: 12 } },
            labelZoomRange: { options: { useLayerZoomRange: true, minZoom: 0, maxZoom: 24 } },
            labelBorderColor: { type: 'STATIC', options: { color: '#FFFFFF' } },
            labelBorderSize: { options: { size: 'SMALL' } },
            labelPosition: { options: { position: 'CENTER' } },
            symbolizeAs: { options: { value: 'circle' } },
          },
        },
      },
    ]),
    uiStateJSON: JSON.stringify({ isLayerTOCOpen: true, openTOCDetails: [] }),
  },
  references: [
    { name: 'layer_1_source_index_pattern', type: 'index-pattern', id: DATA_VIEW },
    { name: 'layer_2_source_index_pattern', type: 'index-pattern', id: DATA_VIEW },
  ],
};

// 48-column grid. Left: tiles, map, heatmap and charts. Right: the IP table. [id, type, x, y, w, h, hide title]
const layout = [
  ['legal-sakshya-unique-ips', 'lens', 0, 0, 10, 7, true],
  ['legal-sakshya-visits', 'lens', 10, 0, 9, 7, true],
  ['legal-sakshya-pdfs', 'lens', 19, 0, 9, 7, true],
  ['legal-sakshya-ip-table', 'lens', 28, 0, 20, 47],
  ['legal-sakshya-map', 'map', 0, 7, 28, 22],
  ['legal-sakshya-heatmap', 'lens', 0, 29, 28, 18],
  ['legal-sakshya-countries', 'lens', 0, 47, 16, 14],
  ['legal-sakshya-states', 'lens', 16, 47, 16, 14],
  ['legal-sakshya-per-day', 'lens', 32, 47, 16, 14],
];
const dashboard = {
  type: 'dashboard',
  id: 'legal-sakshya-dashboard',
  attributes: {
    title: 'Legal Sakshya usage',
    description: 'Visitors, unique IP addresses, where they are and when they visit. Data: logs-legal_sakshya.otel-*.',
    timeRestore: true,
    timeFrom: 'now-30d',
    timeTo: 'now',
    refreshInterval: { pause: false, value: 300000 },
    kibanaSavedObjectMeta: { searchSourceJSON: JSON.stringify({ query: kql(''), filter: [] }) },
    optionsJSON: JSON.stringify({ useMargins: true, syncColors: false, syncCursor: true, syncTooltips: false, hidePanelTitles: false }),
    panelsJSON: JSON.stringify(
      layout.map(([id, type, x, y, w, h, hideTitle], i) => ({
        type,
        gridData: { x, y, w, h, i: `p${i + 1}` },
        panelIndex: `p${i + 1}`,
        embeddableConfig: { enhancements: {}, ...(hideTitle ? { hidePanelTitles: true } : {}) },
        panelRefName: `panel_p${i + 1}`,
      })),
    ),
  },
  references: layout.map(([id, type], i) => ({ name: `p${i + 1}:panel_p${i + 1}`, type, id })),
};

// The saved object versions of Kibana 9.0, the oldest Kibana with the Managed OTLP endpoint. Newer Kibanas upgrade
// them on import; without them Kibana would treat the objects as 7.x ones.
const VERSIONS = { 'index-pattern': '8.0.0', lens: '8.9.0', map: '8.4.0', dashboard: '10.2.0' };
for (const object of [dataView, ...panels, map, dashboard]) {
  const versioned = { ...object, coreMigrationVersion: '8.8.0', typeMigrationVersion: VERSIONS[object.type] };
  process.stdout.write(`${JSON.stringify(versioned)}\n`);
}
