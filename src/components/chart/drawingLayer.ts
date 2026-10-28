import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
  UTCTimestamp,
} from "lightweight-charts";

export type DrawingTool = "none" | "trend" | "hline" | "fib";
export type DrawingPoint = { time: number; price: number };
export type Drawing =
  | { id: string; kind: "trend" | "fib"; a: DrawingPoint; b: DrawingPoint }
  | { id: string; kind: "hline"; price: number };

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_COLORS = ["#8b95a1", "#f04452", "#ff9500", "#00c896", "#3182f6", "#7b5cff", "#8b95a1"];
const LINE_COLOR = "#3182f6";

/** 추세선·수평선·피보나치 되돌림을 캔들 시리즈 위에 그린다. 시각은 차트 표시용 시각(KST 보정 후)을 받는다. */
export class DrawingLayer implements ISeriesPrimitive<Time> {
  private param: SeriesAttachedParameter<Time> | null = null;
  private drawings: Drawing[] = [];
  private preview: Drawing | null = null;
  private readonly views: IPrimitivePaneView[] = [{ renderer: () => this.renderer, zOrder: () => "top" }];
  private readonly renderer: IPrimitivePaneRenderer = { draw: (target) => this.draw(target) };

  constructor(private readonly toChartTime: (time: number) => number) {}

  attached(param: SeriesAttachedParameter<Time>) {
    this.param = param;
  }

  detached() {
    this.param = null;
  }

  paneViews() {
    return this.views;
  }

  setDrawings(drawings: Drawing[], preview: Drawing | null) {
    this.drawings = drawings;
    this.preview = preview;
    this.param?.requestUpdate();
  }

  private x(time: number) {
    return this.param?.chart.timeScale().timeToCoordinate(this.toChartTime(time) as UTCTimestamp) ?? null;
  }

  private y(price: number) {
    return this.param?.series.priceToCoordinate(price) ?? null;
  }

  private draw(target: CanvasRenderingTarget2D) {
    if (!this.param) return;
    const items = this.preview ? [...this.drawings, this.preview] : this.drawings;

    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      ctx.save();
      ctx.font = "11px Pretendard, sans-serif";
      ctx.lineWidth = 1.5;

      for (const d of items) {
        const isPreview = d === this.preview;
        ctx.globalAlpha = isPreview ? 0.6 : 1;

        if (d.kind === "hline") {
          const y = this.y(d.price);
          if (y === null) continue;
          ctx.strokeStyle = LINE_COLOR;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(mediaSize.width, y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = LINE_COLOR;
          ctx.fillText(formatLabel(d.price), 6, y - 4);
          continue;
        }

        const x1 = this.x(d.a.time);
        const x2 = this.x(d.b.time);
        const y1 = this.y(d.a.price);
        const y2 = this.y(d.b.price);
        if (x1 === null || x2 === null || y1 === null || y2 === null) continue;

        if (d.kind === "trend") {
          ctx.strokeStyle = LINE_COLOR;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          for (const [x, y] of [[x1, y1], [x2, y2]]) {
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = "#fff";
            ctx.fill();
            ctx.stroke();
          }
          continue;
        }

        const left = Math.min(x1, x2);
        const right = Math.max(Math.max(x1, x2), left + 60);
        FIB_LEVELS.forEach((level, i) => {
          const price = d.b.price + (d.a.price - d.b.price) * level;
          const y = this.y(price);
          if (y === null) return;
          ctx.strokeStyle = FIB_COLORS[i];
          ctx.beginPath();
          ctx.moveTo(left, y);
          ctx.lineTo(right, y);
          ctx.stroke();
          ctx.fillStyle = FIB_COLORS[i];
          ctx.fillText(`${level} (${formatLabel(price)})`, right + 4, y + 4);
        });
      }
      ctx.restore();
    });
  }
}

function formatLabel(price: number) {
  return price >= 1 ? price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : price.toPrecision(4);
}
