import * as _d3 from 'd3';

declare global {
  const d3: typeof _d3;
  namespace d3 {
    type Selection<
      GElement extends _d3.BaseType,
      Datum,
      PElement extends _d3.BaseType,
      PDatum
    > = _d3.Selection<GElement, Datum, PElement, PDatum>;
    type BaseType = _d3.BaseType;
    type Path = _d3.Path;
  }
}
