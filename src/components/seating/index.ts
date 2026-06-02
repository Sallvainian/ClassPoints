export { ViewModeToggle } from './ViewModeToggle';
export { EmptyChartPrompt } from './EmptyChartPrompt';
export { SeatCard } from './SeatCard';
export { TableGroup } from './TableGroup';
export { RoomElementDisplay } from './RoomElementDisplay';
export { SeatingChartCanvas } from './SeatingChartCanvas';
export { SeatingChartView } from './SeatingChartView';
// SeatingChartEditor is intentionally NOT re-exported: it is lazy-loaded via
// dynamic import in SeatingChartView. A static barrel re-export would pull it
// into every chunk that touches this barrel (e.g. DashboardView), defeating the
// code-split (Vite/Rollup INEFFECTIVE_DYNAMIC_IMPORT). Import it directly if ever
// needed statically.
