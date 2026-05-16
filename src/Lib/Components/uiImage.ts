// uiImage.ts

import {
  Color,
  Engine,
  EventEmitter,
  ExcaliburGraphicsContext,
  GameEvent,
  Graphic,
  ImageSource,
  PointerEvent,
  Sprite,
  vec,
  Vector,
} from "excalibur";
import { BaseUIConfig, DisplayUIComponent, IClickable, IHoverable } from "./uiComponent";

// #region Events

/**
 * Event map for UIImage lifecycle events.
 */
export type UIImageEvents = {
  UIImageShown: UIImageShown;
  UIImageHidden: UIImageHidden;
  UIImageLoaded: UIImageLoaded;
  UIImageHovered: UIImageHovered;
  UIImageUnhovered: UIImageUnhovered;
  UIImageClicked: UIImageClicked;
};

// #endregion Events

// #region Config

/**
 * Supported image fitting modes.
 */
export type ImageFit = "contain" | "cover" | "fill" | "scale-down" | "none";

/**
 * Configuration options for {@link UIImage}.
 */
export type UIImageConfig = BaseUIConfig & {
  /** Image source to render. */
  image?: Sprite | ImageSource;

  /** How the image should fit inside the container. */
  fit?: ImageFit;

  /** Optional background fill color. */
  backgroundColor?: Color;

  /** Border thickness in pixels. */
  borderWidth?: number;

  /** Border stroke color. */
  borderColor?: Color;

  /** Border corner radius. */
  borderRadius?: number;

  /** Whether the image starts visible. */
  visible?: boolean;
};

const defaultImageConfig: UIImageConfig = {
  name: "UIImage",
  width: 200,
  height: 150,
  pos: vec(0, 0),
  z: 0,
  fit: "contain",
  backgroundColor: Color.Transparent,
  borderWidth: 0,
  borderRadius: 0,
  visible: true,
};

// #endregion Config

// #region Component

/**
 * UI component that renders an image inside a styled container.
 *
 * Supports multiple fit modes, optional background fill, rounded corners,
 * and border styling.
 */
export class UIImage extends DisplayUIComponent implements IHoverable, IClickable {
  protected _visible = true;
  protected _config: UIImageConfig;
  protected _graphic: UIImageGraphic;
  _isHovered: boolean = false;

  get isHovered(): boolean {
    return this._isHovered;
  }

  /** Event emitter for UIImage events. */
  public emitter: EventEmitter<UIImageEvents>;

  constructor(config: Partial<UIImageConfig>) {
    const localConfig = { ...defaultImageConfig, ...config };

    super({
      name: localConfig.name,
      width: localConfig.width,
      height: localConfig.height,
      pos: localConfig.pos,
      z: localConfig.z,
    });

    this._config = localConfig;
    this._visible = localConfig.visible ?? true;

    const size = vec(localConfig.width, localConfig.height);
    this._graphic = new UIImageGraphic(size, this._config);
    this.graphics.use(this._graphic);

    this.emitter = new EventEmitter<UIImageEvents>();
  }

  changeBackGroundColor(color: Color) {
    this._config.backgroundColor = color;
    this._graphic.changeBackGroundColor(color);
  }

  onAdd(_engine: Engine): void {
    if (!this._visible) {
      this.graphics.isVisible = false;
    }

    //pointevents
    this.on("pointerenter", this.onHover);
    this.on("pointerleave", this.onUnhover);
    this.on("pointerup", this.onClick);
  }

  onRemove(engine: Engine): void {
    this.off("pointerenter", this.onHover);
    this.off("pointerleave", this.onUnhover);
    this.off("pointerup", this.onClick);
  }

  onHover = (event: PointerEvent): void => {
    this._isHovered = true;
    this.emitter.emit("UIImageHovered", { name: this.name, target: this, event: "hovered", image: this._config.image });
  };
  onUnhover = (event: PointerEvent): void => {
    this._isHovered = false;
    this.emitter.emit("UIImageUnhovered", { name: this.name, target: this, event: "unhovered", image: this._config.image });
  };

  onClick = (event: PointerEvent): void => {
    this.emitter.emit("UIImageClicked", { name: this.name, target: this, event: "clicked", image: this._config.image });
  };

  onPointerDown(event: PointerEvent): void {}

  /**
   * Makes the image visible.
   */
  show(): void {
    if (!this._visible) {
      this._visible = true;
      this.graphics.isVisible = true;
      this.emitter.emit("UIImageShown", { name: this.name, target: this, event: "shown", image: this._config.image });
    }
  }

  /**
   * Hides the image.
   */
  hide(): void {
    if (this._visible) {
      this._visible = false;
      this.graphics.isVisible = false;
      this.emitter.emit("UIImageHidden", { name: this.name, target: this, event: "hidden", image: this._config.image });
    }
  }

  /**
   * Toggles the image visibility.
   */
  toggle(): void {
    this._visible ? this.hide() : this.show();
  }

  /**
   * Returns whether the image is currently visible.
   */
  get isVisible(): boolean {
    return this._visible;
  }

  /**
   * Returns the event emitter for this image.
   */
  get eventEmitter(): EventEmitter<UIImageEvents> {
    return this.emitter;
  }

  /**
   * Sets a new image source.
   */
  setImage(image: Sprite | ImageSource): void {
    this._config.image = image;
    this._graphic.setImage(image);
    this.emitter.emit("UIImageLoaded", { name: this.name, target: this, event: "loaded", image: this._config.image });
  }

  /**
   * Sets how the image fits inside the container.
   */
  setFit(fit: ImageFit): void {
    this._config.fit = fit;
    this._graphic.setFit(fit);
  }

  /**
   * Returns the current image source.
   */
  get image(): Sprite | ImageSource | undefined {
    return this._config.image;
  }

  /**
   * Returns the current fit mode.
   */
  get fit(): ImageFit | undefined {
    return this._config.fit;
  }
}

// #endregion Component

// #region Graphic

/**
 * Internal graphic used to render the UIImage.
 */
class UIImageGraphic extends Graphic {
  private size: Vector;
  private config: UIImageConfig;
  private image: Sprite | ImageSource | null;
  private fit: ImageFit;

  private cnv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(size: Vector, imageConfig: UIImageConfig) {
    super({ width: size.x, height: size.y });

    this.size = size;
    this.config = imageConfig;
    this.image = imageConfig.image ?? null;
    this.fit = imageConfig.fit ?? "contain";

    this.cnv = document.createElement("canvas");
    this.cnv.width = this.size.x;
    this.cnv.height = this.size.y;
    this.ctx = this.cnv.getContext("2d")!;
  }

  clone(): UIImageGraphic {
    return new UIImageGraphic(this.size, this.config);
  }

  changeBackGroundColor(color: Color) {
    this.config.backgroundColor = color;
  }

  setImage(image: Sprite | ImageSource): void {
    this.image = image;
  }

  setFit(fit: ImageFit): void {
    this.fit = fit;
  }

  protected _drawImage(ex: ExcaliburGraphicsContext, x: number, y: number): void {
    const ctx = this.ctx;

    ctx.clearRect(0, 0, this.size.x, this.size.y);

    // Background
    if (this.config.backgroundColor && this.config.backgroundColor.a > 0) {
      ctx.fillStyle = this.config.backgroundColor.toString();
      if (this.config.borderRadius && this.config.borderRadius > 0) {
        ctx.beginPath();
        ctx.roundRect(0, 0, this.size.x, this.size.y, this.config.borderRadius);
        ctx.fill();
      } else {
        ctx.fillRect(0, 0, this.size.x, this.size.y);
      }
    }

    // Image
    if (this.image) {
      const htmlImage = this.getHTMLImage(this.image);
      if (htmlImage && htmlImage.complete) {
        this.drawImageWithFit(ctx, htmlImage);
      }
    }

    // Border
    if (this.config.borderWidth && this.config.borderWidth > 0 && this.config.borderColor) {
      ctx.strokeStyle = this.config.borderColor.toString();
      ctx.lineWidth = this.config.borderWidth;

      if (this.config.borderRadius && this.config.borderRadius > 0) {
        ctx.beginPath();
        ctx.roundRect(
          this.config.borderWidth / 2,
          this.config.borderWidth / 2,
          this.size.x - this.config.borderWidth,
          this.size.y - this.config.borderWidth,
          this.config.borderRadius,
        );
        ctx.stroke();
      } else {
        ctx.strokeRect(
          this.config.borderWidth / 2,
          this.config.borderWidth / 2,
          this.size.x - this.config.borderWidth,
          this.size.y - this.config.borderWidth,
        );
      }
    }

    this.cnv.setAttribute("forceUpload", "true");
    ex.drawImage(this.cnv, x, y);
  }

  private getHTMLImage(image: Sprite | ImageSource): HTMLImageElement | null {
    if (image instanceof Sprite) return image.image.image;
    if (image instanceof ImageSource) return image.image;
    return null;
  }

  private drawImageWithFit(ctx: CanvasRenderingContext2D, img: HTMLImageElement): void {
    const cw = this.size.x;
    const ch = this.size.y;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;

    if (this.config.borderRadius && this.config.borderRadius > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(0, 0, cw, ch, this.config.borderRadius);
      ctx.clip();
    }

    switch (this.fit) {
      case "contain":
        this.drawContain(ctx, img, cw, ch, iw, ih);
        break;
      case "cover":
        this.drawCover(ctx, img, cw, ch, iw, ih);
        break;
      case "fill":
        ctx.drawImage(img, 0, 0, cw, ch);
        break;
      case "scale-down":
        this.drawScaleDown(ctx, img, cw, ch, iw, ih);
        break;
      case "none":
        ctx.drawImage(img, (cw - iw) / 2, (ch - ih) / 2, iw, ih);
        break;
    }

    if (this.config.borderRadius && this.config.borderRadius > 0) {
      ctx.restore();
    }
  }

  private drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cw: number, ch: number, iw: number, ih: number): void {
    const scale = Math.min(cw / iw, ch / ih);
    const sw = iw * scale;
    const sh = ih * scale;
    ctx.drawImage(img, (cw - sw) / 2, (ch - sh) / 2, sw, sh);
  }

  private drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cw: number, ch: number, iw: number, ih: number): void {
    const scale = Math.max(cw / iw, ch / ih);
    const sw = iw * scale;
    const sh = ih * scale;
    ctx.drawImage(img, (cw - sw) / 2, (ch - sh) / 2, sw, sh);
  }

  private drawScaleDown(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cw: number, ch: number, iw: number, ih: number): void {
    const scale = Math.min(1, Math.min(cw / iw, ch / ih));
    const sw = iw * scale;
    const sh = ih * scale;
    ctx.drawImage(img, (cw - sw) / 2, (ch - sh) / 2, sw, sh);
  }
}

// #endregion Graphic

// #region Events

/**
 * Fired when the image is shown.
 */
export class UIImageShown extends GameEvent<UIImage> {
  constructor(public target: UIImage) {
    super();
  }
}

/**
 * Fired when the image is hidden.
 */
export class UIImageHidden extends GameEvent<UIImage> {
  constructor(public target: UIImage) {
    super();
  }
}

/**
 * Fired when a new image is assigned.
 */
export class UIImageLoaded extends GameEvent<UIImage> {
  constructor(public target: UIImage) {
    super();
  }
}

export class UIImageHovered extends GameEvent<UIImage> {
  constructor(public target: UIImage) {
    super();
  }
}

export class UIImageUnhovered extends GameEvent<UIImage> {
  constructor(public target: UIImage) {
    super();
  }
}

export class UIImageClicked extends GameEvent<UIImage> {
  constructor(public target: UIImage) {
    super();
  }
}

// #endregion Events
