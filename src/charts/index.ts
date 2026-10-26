/**
 * Einstieg des nachgeladenen Chunks `charts`.
 *
 * Alles, was Chart.js braucht, wird nur ueber diese Datei und nur per
 * dynamischem Import erreicht, siehe `src/ui/charts.ts`. Ein statischer Import
 * aus `src/charts/` an anderer Stelle zieht Chart.js zurueck in den Haupt Chunk.
 */
export { barChart, destroyAllCharts, getChart, lineChart, mutableOptions, resizeVisibleCharts, upsert } from './base';
export { renderWeightChart } from './weight';
export { renderDailyTargetChart } from './nutrition';
export { sparkline } from './sparkline';
