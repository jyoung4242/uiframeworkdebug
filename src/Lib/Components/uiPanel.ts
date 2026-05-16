import {
  Color,
  Engine,
  ExcaliburGraphicsContext,
  GameEvent,
  Graphic,
  Sprite,
  vec,
  Vector,
  NineSlice,
  NineSliceConfig,
  NineSliceStretch,
  PointerEvent,
} from "excalibur";
import { BaseUIConfig, DisplayUIComponent, IHoverable } from "./uiComponent";

/**
 * Event map emitted by all UIPanel variants.
 */
export type UIPanelEvents = {
  UIPanelShown: UIPanelShown;
  UIPanelHidden: UIPanelHidden;
  UIPanelHovered: UIPanelHovered;
  UIPanelUnhovered: UIPanelUnhovered;
};

// #region Standard Panel

/**
 * Configuration options for a standard UIPanel.
 */
export type UIPanelConfig = BaseUIConfig & {
  /** Background and border colors. */
  colors?: UIPanelColors;
  /** Border thickness in pixels. */
  borderWidth?: number;
  /** Corner radius in pixels. */
  panelRadius?: number;
  /** Padding for child content layout. */
  padding?: Vector;
  /** Initial visibility state. */
  visible?: boolean;
  /** Optional drop shadow configuration. */
  shadow?: {
    offsetX: number;
    offsetY: number;
    blur: number;
    color: Color;
  };
};

/** Default configuration values for `UIPanel`. */
const defaultPanelConfig: UIPanelConfig = {
  name: "UIPanel",
  width: 200,
  height: 150,
  pos: vec(0, 0),
  z: 0,
  colors: {
    backgroundStarting: Color.fromHex("#f0f0f0"),
    borderColor: Color.fromHex("#cccccc"),
  },
  borderWidth: 2,
  panelRadius: 12,
  padding: vec(10, 10),
  visible: true,
};

/**
 * Color configuration for a gradient-backed UIPanel.
 */
type UIPanelColors = {
  /** Top gradient color. */
  backgroundStarting: Color;
  /** Bottom gradient color. */
  backgroundEnding?: Color;
  /** Optional border color. */
  borderColor?: Color;
};

/**
 * A rectangular UI panel with gradient background and optional border.
 *
 * Used as a container for other UI elements. Extends DisplayUIComponent
 * since panels are non-interactive display elements.
 */
export class UIPanel extends DisplayUIComponent<UIPanelConfig, UIPanelEvents> implements IHoverable {
  /**
   * Create a new UIPanel.
   * @param panelConfig - Partial configuration; defaults will be applied.
   */
  _isHovered: boolean;

  constructor(panelConfig: Partial<UIPanelConfig>) {
    const localConfig = { ...defaultPanelConfig, ...panelConfig };
    super(localConfig);
    this._config = localConfig;
    this._visible = localConfig.visible ?? true;
    this._isHovered = false;
    const size = vec(localConfig.width, localConfig.height);
    this.graphics.use(new UIPanelGraphic(size, this._config));
    this.pointer.useGraphicsBounds = true;
    // Set initial visibility
    if (!this._visible) {
      this.graphics.isVisible = false;
    }
  }

  /**
   * Called when the panel is added to the engine.
   * @param engine - The engine instance.
   */
  onAdd(engine: Engine): void {
    console.log("running parent onadd");

    // Ensure visibility state is correct
    if (!this._visible) {
      this.graphics.isVisible = false;
    }

    this.on("pointerenter", this.onHover);
    this.on("pointerleave", this.onUnhover);
  }

  /**
   * Called when the panel is removed from the engine.
   * @param engine - The engine instance.
   */
  onRemove(engine: Engine): void {
    // Optionally emit hidden event on removal
    this.off("pointerenter", this.onHover);
    this.off("pointerleave", this.onUnhover);
  }

  onHover = (): void => {
    console.log("base hover");

    if (!this._isHovered) {
      this._isHovered = true;
      this.emitter.emit("UIPanelHovered", { name: this.name, target: this, event: "hovered" });
    }
  };

  onUnhover = (): void => {
    if (this._isHovered) {
      this._isHovered = false;
      this.emitter.emit("UIPanelUnhovered", { name: this.name, target: this, event: "unhovered" });
    }
  };

  get isHovered(): boolean {
    return this._isHovered;
  }
  /**
   * Hook called when panel is shown.
   * Override to emit events or perform custom logic.
   */
  protected onShow(): void {
    this.emitter.emit("UIPanelShown", { name: this.name, target: this, event: "shown" });
  }

  /**
   * Hook called when panel is hidden.
   * Override to emit events or perform custom logic.
   */
  protected onHide(): void {
    this.emitter.emit("UIPanelHidden", { name: this.name, target: this, event: "hidden" });
  }

  /**
   * Access the panel event emitter.
   */
  get eventEmitter() {
    return this.emitter;
  }

  /**
   * Content layout bounds inside the panel, accounting for padding.
   */
  get contentArea() {
    const padding = this._config.padding ?? vec(10, 10);
    return {
      x: padding.x,
      y: padding.y,
      width: this._config.width - padding.x * 2,
      height: this._config.height - padding.y * 2,
    };
  }
}

/**
 * Graphic implementation for rendering a `UIPanel` to a canvas.
 * Handles drawing the background gradient, border, and optional shadow.
 */
class UIPanelGraphic extends Graphic {
  private size: Vector;
  private config: UIPanelConfig;
  private radius = 12;
  private borderWidth = 2;
  private colors: UIPanelColors;

  cnv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  /**
   * Create the panel graphic.
   * @param size - Size of the panel (width,height) for rendering.
   * @param panelConfig - Panel configuration for styling.
   */
  constructor(size: Vector, panelConfig: UIPanelConfig) {
    super({ width: size.x, height: size.y });
    this.size = size;
    this.config = panelConfig;
    this.cnv = document.createElement("canvas");
    this.cnv.width = this.size.x;
    this.cnv.height = this.size.y;
    this.ctx = this.cnv.getContext("2d")!;
    this.radius = panelConfig.panelRadius ?? this.radius;
    this.borderWidth = panelConfig.borderWidth ?? this.borderWidth;
    this.colors = {
      backgroundStarting: Color.fromHex("#f0f0f0"),
      borderColor: Color.fromHex("#cccccc"),
      ...panelConfig.colors,
    };
  }

  /** Create a deep clone of this graphic (used by Excalibur). */
  clone(): UIPanelGraphic {
    return new UIPanelGraphic(this.size, this.config);
  }

  /**
   * Render the panel to an offscreen canvas and draw it into the Excalibur context.
   * @param ex - Excalibur rendering context used to draw the final image.
   * @param x - X coordinate to draw at.
   * @param y - Y coordinate to draw at.
   */
  protected _drawImage(ex: ExcaliburGraphicsContext, x: number, y: number): void {
    const cnv = this.cnv;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.size.x, this.size.y);

    if (!ctx || !cnv) return;

    // Draw shadow if configured
    if (this.config.shadow) {
      ctx.save();
      ctx.shadowOffsetX = this.config.shadow.offsetX;
      ctx.shadowOffsetY = this.config.shadow.offsetY;
      ctx.shadowBlur = this.config.shadow.blur;
      ctx.shadowColor = this.config.shadow.color.toString();
    }

    // Draw background
    this.drawRoundedRect(ctx, 0, 0, this.size.x, this.size.y, this.radius, this.backgroundGradient(ctx));

    if (this.config.shadow) {
      ctx.restore();
    }

    // Draw border (as an inset fill to avoid stroke bleeding outside)
    if (this.borderWidth > 0 && this.colors.borderColor) {
      // Draw outer border shape
      ctx.fillStyle = this.colors.borderColor.toString();
      ctx.beginPath();
      ctx.roundRect(0, 0, this.size.x, this.size.y, this.radius);
      ctx.fill();

      // Cut out inner area to create border effect
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.roundRect(
        this.borderWidth,
        this.borderWidth,
        this.size.x - this.borderWidth * 2,
        this.size.y - this.borderWidth * 2,
        Math.max(0, this.radius - this.borderWidth),
      );
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";

      // Redraw background inside the border
      this.drawRoundedRect(
        ctx,
        this.borderWidth,
        this.borderWidth,
        this.size.x - this.borderWidth * 2,
        this.size.y - this.borderWidth * 2,
        Math.max(0, this.radius - this.borderWidth),
        this.backgroundGradient(ctx),
      );
    }

    // Draw image to ex
    cnv.setAttribute("forceUpload", "true");
    ex.drawImage(cnv, x, y);
  }

  /**
   * Create a background gradient for the panel.
   * @param ctx - Canvas rendering context used to create the gradient.
   */
  private backgroundGradient(ctx: CanvasRenderingContext2D): CanvasGradient {
    const g = ctx.createLinearGradient(0, 0, 0, this.size.y);
    g.addColorStop(0, this.colors.backgroundStarting.toString());
    this.colors.backgroundEnding
      ? g.addColorStop(1, this.colors.backgroundEnding.toString())
      : g.addColorStop(1, this.colors.backgroundStarting.toString());
    return g;
  }

  /**
   * Helper to draw a rounded rectangle filled with the provided gradient.
   * @param ctx - Canvas rendering context.
   * @param x - X position.
   * @param y - Y position.
   * @param w - Width.
   * @param h - Height.
   * @param r - Corner radius.
   * @param fill - Fill style (gradient).
   */
  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: CanvasGradient,
  ): void {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  }
}
// #endregion Standard Panel

// #region Sprite Panel

/**
 * Configuration options for a sprite-backed UIPanel.
 */
export type UISpritePanelConfig = BaseUIConfig & {
  /** Sprite to render as the panel background. */
  sprite?: Sprite;
  /** Padding for child content layout. */
  padding?: Vector;
  /** Initial visibility state. */
  visible?: boolean;
};

/** Default configuration values for `UISpritePanel`. */
const defaultSpritePanelConfig: UISpritePanelConfig = {
  name: "UISpritePanel",
  width: 200,
  height: 150,
  pos: vec(0, 0),
  z: 0,
  padding: vec(10, 10),
  visible: true,
};

/**
 * A sprite-backed UI panel.
 *
 * Renders a Sprite stretched to the panel bounds.
 */
export class UISpritePanel extends DisplayUIComponent<UISpritePanelConfig, UIPanelEvents> implements IHoverable {
  _isHovered: boolean;
  get isHovered(): boolean {
    return this._isHovered;
  }

  /**
   * Create a new UISpritePanel.
   * @param panelConfig - Partial configuration; defaults will be applied.
   */
  constructor(panelConfig: Partial<UISpritePanelConfig>) {
    const localConfig = { ...defaultSpritePanelConfig, ...panelConfig };
    super(localConfig);
    this._config = localConfig;
    this._visible = localConfig.visible ?? true;
    this._isHovered = false;
    const size = vec(localConfig.width, localConfig.height);
    this.graphics.use(new UISpritePanelGraphic(size, this._config));

    // Set initial visibility
    if (!this._visible) {
      this.graphics.isVisible = false;
    }
  }

  /**
   * Called when the panel is added to the engine.
   * @param engine - The engine instance.
   */
  onAdd(engine: Engine): void {
    // Ensure visibility state is correct
    if (!this._visible) {
      this.graphics.isVisible = false;
    }
    this.on("pointerenter", this.onHover);
    this.on("pointerleave", this.onUnhover);
  }

  /**
   * Called when the panel is removed from the engine.
   * @param engine - The engine instance.
   */
  onRemove(engine: Engine): void {
    // Optionally emit hidden event on removal
    this.off("pointerenter", this.onHover);
    this.off("pointerleave", this.onUnhover);
  }

  onHover = (): void => {
    if (!this._isHovered) {
      this._isHovered = true;
      this.emitter.emit("UIPanelHovered", { name: this.name, target: this, event: "hovered" });
    }
  };

  onUnhover = (): void => {
    if (this._isHovered) {
      this._isHovered = false;
      this.emitter.emit("UIPanelUnhovered", { name: this.name, target: this, event: "unhovered" });
    }
  };

  /**
   * Hook called when panel is shown.
   * Override to emit events or perform custom logic.
   */
  protected onShow(): void {
    this.emitter.emit("UIPanelShown", { name: this.name, target: this, event: "shown" });
  }

  /**
   * Hook called when panel is hidden.
   * Override to emit events or perform custom logic.
   */
  protected onHide(): void {
    this.emitter.emit("UIPanelHidden", { name: this.name, target: this, event: "hidden" });
  }

  /**
   * Access the panel event emitter.
   */
  get eventEmitter() {
    return this.emitter;
  }

  /**
   * Content layout bounds inside the panel, accounting for padding.
   */
  get contentArea() {
    const padding = this._config.padding ?? vec(10, 10);
    return {
      x: padding.x,
      y: padding.y,
      width: this._config.width - padding.x * 2,
      height: this._config.height - padding.y * 2,
    };
  }
}

/**
 * Graphic implementation for rendering a `UISpritePanel` to a canvas.
 * Handles drawing a sprite stretched to the panel dimensions.
 */
class UISpritePanelGraphic extends Graphic {
  private size: Vector;
  private config: UISpritePanelConfig;
  private sprite: Sprite | null;

  cnv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  /**
   * Create the sprite panel graphic.
   * @param size - Size of the panel (width,height) for rendering.
   * @param panelConfig - Sprite panel configuration.
   */
  constructor(size: Vector, panelConfig: UISpritePanelConfig) {
    super({ width: size.x, height: size.y });
    this.size = size;
    this.config = panelConfig;
    this.cnv = document.createElement("canvas");
    this.cnv.width = this.size.x;
    this.cnv.height = this.size.y;
    this.ctx = this.cnv.getContext("2d")!;
    this.sprite = panelConfig.sprite ?? null;
  }

  /** Create a deep clone of this graphic (used by Excalibur). */
  clone(): UISpritePanelGraphic {
    return new UISpritePanelGraphic(this.size, this.config);
  }

  /**
   * Render the sprite panel to an offscreen canvas and draw it into the Excalibur context.
   * @param ex - Excalibur rendering context used to draw the final image.
   * @param x - X coordinate to draw at.
   * @param y - Y coordinate to draw at.
   */
  protected _drawImage(ex: ExcaliburGraphicsContext, x: number, y: number): void {
    const cnv = this.cnv;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.size.x, this.size.y);

    if (!ctx || !cnv) return;

    if (!this.sprite) {
      // Draw default background if no sprite
      ctx.fillStyle = "#f0f0f0";
      ctx.fillRect(0, 0, this.size.x, this.size.y);
      ctx.strokeStyle = "#cccccc";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, this.size.x - 2, this.size.y - 2);
    } else {
      // Draw sprite scaled to panel size
      const image = this.sprite.image.image;
      ctx.drawImage(image, 0, 0, this.size.x, this.size.y);
    }

    // Draw image to ex
    cnv.setAttribute("forceUpload", "true");
    ex.drawImage(cnv, x, y);
  }
}
// #endregion Sprite Panel

// #region Nine-Slice Panel

/**
 * Configuration options for a nine-slice panel.
 */
export type UINineSlicePanelConfig = BaseUIConfig & {
  /** Sprite source used for slicing. */
  sprite: Sprite;
  /** Nine-slice source region configuration. */
  sourceConfig: {
    width: number;
    height: number;
    topMargin: number;
    leftMargin: number;
    bottomMargin: number;
    rightMargin: number;
  };
  /** Nine-slice destination behavior configuration. */
  destinationConfig?: {
    drawCenter: boolean;
    stretchH: NineSliceStretch;
    stretchV: NineSliceStretch;
  };
  /** Padding for child content layout. */
  padding?: Vector;
  /** Initial visibility state. */
  visible?: boolean;
};

/** Default configuration values for `UINineSlicePanel`. */
const defaultNineSlicePanelConfig: Partial<UINineSlicePanelConfig> = {
  name: "UINineSlicePanel",
  width: 200,
  height: 150,
  pos: vec(0, 0),
  z: 0,
  padding: vec(10, 10),
  visible: true,
  destinationConfig: {
    drawCenter: true,
    stretchH: NineSliceStretch.Stretch,
    stretchV: NineSliceStretch.Stretch,
  },
};

/**
 * A nine-slice scalable UI panel.
 *
 * Preserves corner fidelity while stretching edges and center.
 * Uses Excalibur's built-in NineSlice graphic.
 */
export class UINineSlicePanel extends DisplayUIComponent<UINineSlicePanelConfig, UIPanelEvents> implements IHoverable {
  _isHovered: boolean;
  get isHovered(): boolean {
    return this._isHovered;
  }
  /**
   * Create a new UINineSlicePanel.
   * @param panelConfig - Configuration including sprite and slice regions.
   */
  constructor(panelConfig: Partial<UINineSlicePanelConfig> & Pick<UINineSlicePanelConfig, "sprite" | "sourceConfig">) {
    const localConfig = { ...defaultNineSlicePanelConfig, ...panelConfig } as UINineSlicePanelConfig;
    super(localConfig);
    this._config = localConfig;
    this._visible = localConfig.visible ?? true;

    const graphConfig: NineSliceConfig = {
      source: this._config.sprite.image,
      width: this._config.width,
      height: this._config.height,
      sourceConfig: { ...this._config.sourceConfig },
      destinationConfig: {
        drawCenter: this._config.destinationConfig?.drawCenter ?? true,
        horizontalStretch: this._config.destinationConfig?.stretchH ?? NineSliceStretch.Stretch,
        verticalStretch: this._config.destinationConfig?.stretchV ?? NineSliceStretch.Stretch,
      },
    };

    this.graphics.use(new NineSlice(graphConfig));

    // Set initial visibility
    if (!this._visible) {
      this.graphics.isVisible = false;
    }
  }

  /**
   * Called when the panel is added to the engine.
   * @param engine - The engine instance.
   */
  onAdd(engine: Engine): void {
    // Ensure visibility state is correct
    if (!this._visible) {
      this.graphics.isVisible = false;
    }
  }

  /**
   * Called when the panel is removed from the engine.
   * @param engine - The engine instance.
   */
  onRemove(engine: Engine): void {
    // Optionally emit hidden event on removal
  }

  onHover = (): void => {
    this._isHovered = true;
    this.emitter.emit("UIPanelHovered", { name: this.name, target: this, event });
  };
  onUnhover = (): void => {
    this._isHovered = false;
    this.emitter.emit("UIPanelUnhovered", { name: this.name, target: this, event });
  };

  /**
   * Hook called when panel is shown.
   * Override to emit events or perform custom logic.
   */
  protected onShow(): void {
    this.emitter.emit("UIPanelShown", { name: this.name, target: this, event: "shown" });
  }

  /**
   * Hook called when panel is hidden.
   * Override to emit events or perform custom logic.
   */
  protected onHide(): void {
    this.emitter.emit("UIPanelHidden", { name: this.name, target: this, event: "hidden" });
  }

  /**
   * Access the panel event emitter.
   */
  get eventEmitter() {
    return this.emitter;
  }

  /**
   * Content layout bounds inside the panel, accounting for padding.
   */
  get contentArea() {
    const padding = this._config.padding ?? vec(10, 10);
    return {
      x: padding.x,
      y: padding.y,
      width: this._config.width - padding.x * 2,
      height: this._config.height - padding.y * 2,
    };
  }
}
// #endregion Nine-Slice Panel

// #region Events

/** Event emitted when a panel becomes visible. */
export class UIPanelShown extends GameEvent<UIPanel | UISpritePanel | UINineSlicePanel> {
  constructor(public target: UIPanel | UISpritePanel | UINineSlicePanel) {
    super();
  }
}

/** Event emitted when a panel is hidden. */
export class UIPanelHidden extends GameEvent<UIPanel | UISpritePanel | UINineSlicePanel> {
  constructor(public target: UIPanel | UISpritePanel | UINineSlicePanel) {
    super();
  }
}

export class UIPanelHovered extends GameEvent<UIPanel | UISpritePanel | UINineSlicePanel> {
  constructor(public target: UIPanel | UISpritePanel | UINineSlicePanel) {
    super();
  }
}

export class UIPanelUnhovered extends GameEvent<UIPanel | UISpritePanel | UINineSlicePanel> {
  constructor(public target: UIPanel | UISpritePanel | UINineSlicePanel) {
    super();
  }
}

// #endregion Events
