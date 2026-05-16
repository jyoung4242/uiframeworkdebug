import {
  Color,
  Engine,
  EventEmitter,
  ExcaliburGraphicsContext,
  GameEvent,
  Graphic,
  ScreenElement,
  Sprite,
  vec,
  Vector,
  Font,
  Text,
  FontUnit,
  Label,
  Actor,
} from "excalibur";
import { UIPanel, UIPanelConfig, UIPanelEvents } from "./uiPanel";

export type UITabbedPanelEvents = UIPanelEvents & {
  TabChanged: TabChangedEvent;
  TabAdded: TabAddedEvent;
  TabRemoved: TabRemovedEvent;
};

export type TabPosition = "top" | "bottom" | "left" | "right";

export type UITabbedPanelConfig = Omit<UIPanelConfig, "padding"> & {
  tabHeight?: number;
  tabMinWidth?: number;
  tabMaxWidth?: number;
  tabPosition?: TabPosition;
  tabSpacing?: number;
  contentPadding?: Vector;
  tabColors?: {
    activeBackground?: Color;
    inactiveBackground?: Color;
    hoverBackground?: Color;
    activeText?: Color;
    inactiveText?: Color;
    hoveredText?: Color; // ✅ ADD
    borderColor?: Color;
  };
};

export type TabConfig = {
  id: string;
  label: string;
  icon?: Sprite;
  closeable?: boolean;
  data?: any; // User data for the tab
};

const defaultTabbedPanelConfig: Partial<UITabbedPanelConfig> = {
  name: "UITabbedPanel",
  width: 400,
  height: 300,
  pos: vec(0, 0),
  z: 0,
  tabHeight: 36,
  tabMinWidth: 80,
  tabMaxWidth: 200,
  tabPosition: "top",
  tabSpacing: 2,
  contentPadding: vec(10, 10),
  visible: true,
  colors: {
    backgroundStarting: Color.fromHex("#f0f0f0"),
    borderColor: Color.fromHex("#cccccc"),
  },
  borderWidth: 2,
  panelRadius: 12,
  tabColors: {
    activeBackground: Color.fromHex("#ffffff"),
    inactiveBackground: Color.fromHex("#e0e0e0"),
    hoverBackground: Color.fromHex("#ececec"),
    activeText: Color.fromHex("#333333"),
    inactiveText: Color.fromHex("#666666"),
    hoveredText: Color.fromHex("#222222"), // ✅ ADD
    borderColor: Color.fromHex("#cccccc"),
  },
};

export class UITabbedPanel extends UIPanel {
  private tabs: Map<string, UITab> = new Map();
  private tabContents: Map<string, UITabContent> = new Map();
  private activeTabId: string | null = null;
  private tabContainer: ScreenElement;
  private contentContainer: ScreenElement;
  private tabbedConfig: UITabbedPanelConfig;
  public tabbedEmitter: EventEmitter<UITabbedPanelEvents>;

  constructor(config: Partial<UITabbedPanelConfig>) {
    const localConfig = { ...defaultTabbedPanelConfig, ...config } as UITabbedPanelConfig;

    // Set padding to accommodate tabs
    const padding = UITabbedPanel.calculatePadding(localConfig);
    super({ ...localConfig, padding });

    this.tabbedConfig = localConfig;
    this.tabbedEmitter = this.emitter as EventEmitter<UITabbedPanelEvents>;

    // Create tab container
    this.tabContainer = new ScreenElement({
      name: `${this.name}_TabContainer`,
      pos: this.getTabContainerPosition(),
      z: 1,
    });
    this.addChild(this.tabContainer);

    // Create content container
    this.contentContainer = new ScreenElement({
      name: `${this.name}_ContentContainer`,
      pos: this.getContentContainerPosition(),
      z: 0,
    });
    this.addChild(this.contentContainer);
  }

  private static calculatePadding(config: UITabbedPanelConfig): Vector {
    const tabHeight = config.tabHeight ?? 36;
    const contentPadding = config.contentPadding ?? vec(10, 10);

    switch (config.tabPosition) {
      case "top":
        return vec(contentPadding.x, tabHeight + contentPadding.y);
      case "bottom":
        return vec(contentPadding.x, contentPadding.y);
      case "left":
        return vec(tabHeight + contentPadding.x, contentPadding.y);
      case "right":
        return vec(contentPadding.x, contentPadding.y);
      default:
        return vec(contentPadding.x, tabHeight + contentPadding.y);
    }
  }

  private getTabContainerPosition(): Vector {
    const borderWidth = this.tabbedConfig.borderWidth ?? 2;
    const tabHeight = this.tabbedConfig.tabHeight ?? 36;

    switch (this.tabbedConfig.tabPosition) {
      case "top":
        return vec(borderWidth, borderWidth);
      case "bottom":
        return vec(borderWidth, this.tabbedConfig.height - tabHeight - borderWidth);
      case "left":
        return vec(borderWidth, borderWidth);
      case "right":
        return vec(this.tabbedConfig.width - tabHeight - borderWidth, borderWidth);
      default:
        return vec(borderWidth, borderWidth);
    }
  }

  private getContentContainerPosition(): Vector {
    const contentPadding = this.tabbedConfig.contentPadding ?? vec(10, 10);
    const tabHeight = this.tabbedConfig.tabHeight ?? 36;
    const borderWidth = this.tabbedConfig.borderWidth ?? 2;

    switch (this.tabbedConfig.tabPosition) {
      case "top":
        return vec(contentPadding.x, tabHeight + contentPadding.y + borderWidth);
      case "bottom":
        return vec(contentPadding.x, contentPadding.y);
      case "left":
        return vec(tabHeight + contentPadding.x + borderWidth, contentPadding.y);
      case "right":
        return vec(contentPadding.x, contentPadding.y);
      default:
        return vec(contentPadding.x, tabHeight + contentPadding.y + borderWidth);
    }
  }

  addTab(config: TabConfig, makeActive: boolean = false): UITab {
    if (this.tabs.has(config.id)) {
      console.warn(`Tab with id "${config.id}" already exists`);
      return this.tabs.get(config.id)!;
    }

    // Calculate tab position
    const tabPos = this.calculateNextTabPosition();
    const isHorizontal = this.tabbedConfig.tabPosition === "top" || this.tabbedConfig.tabPosition === "bottom";

    // Create tab
    const tab = new UITab({
      id: config.id,
      label: config.label,
      icon: config.icon,
      closeable: config.closeable,
      pos: tabPos,
      width: isHorizontal ? (this.tabbedConfig.tabMinWidth ?? 80) : (this.tabbedConfig.tabHeight ?? 36),
      height: isHorizontal ? (this.tabbedConfig.tabHeight ?? 36) : (this.tabbedConfig.tabMinWidth ?? 80),
      colors: this.tabbedConfig.tabColors,
      isActive: false,
      isHorizontal,
    });

    // Set up tab events
    tab.on("pointerdown", () => {
      this.setActiveTab(config.id);
    });

    if (config.closeable) {
      tab.on("close", () => {
        this.removeTab(config.id);
      });
    }

    // Create content container for this tab
    const tabContent = new UITabContent({
      id: config.id,
      visible: false,
    });

    // Add to collections
    this.tabs.set(config.id, tab);
    this.tabContents.set(config.id, tabContent);
    this.tabContainer.addChild(tab);
    this.contentContainer.addChild(tabContent);

    // Emit event
    this.tabbedEmitter.emit("TabAdded", new TabAddedEvent(this, config.id, tab));

    // Set as active if requested or if it's the first tab
    if (makeActive || this.tabs.size === 1) {
      this.setActiveTab(config.id);
    }

    return tab;
  }

  removeTab(tabId: string): boolean {
    const tab = this.tabs.get(tabId);
    const content = this.tabContents.get(tabId);

    if (!tab || !content) {
      return false;
    }

    // Remove from containers
    this.tabContainer.removeChild(tab);
    this.contentContainer.removeChild(content);

    // Remove from collections
    this.tabs.delete(tabId);
    this.tabContents.delete(tabId);

    // If this was the active tab, activate another
    if (this.activeTabId === tabId) {
      this.activeTabId = null;
      const remainingTabs = Array.from(this.tabs.keys());
      if (remainingTabs.length > 0) {
        this.setActiveTab(remainingTabs[0]);
      }
    }

    // Reposition remaining tabs
    this.repositionTabs();

    // Emit event
    this.tabbedEmitter.emit("TabRemoved", new TabRemovedEvent(this, tabId));

    return true;
  }

  setActiveTab(tabId: string): boolean {
    const tab = this.tabs.get(tabId);
    const content = this.tabContents.get(tabId);
    if (!tab || !content) {
      return false;
    }

    // Deactivate current tab
    if (this.activeTabId) {
      const currentTab = this.tabs.get(this.activeTabId);
      const currentContent = this.tabContents.get(this.activeTabId);
      if (currentTab) currentTab.setActive(false);
      if (currentContent) currentContent.hide();
    }

    // Activate new tab
    this.activeTabId = tabId;
    tab.setActive(true);
    content.show();

    // Emit event
    this.tabbedEmitter.emit("TabChanged", new TabChangedEvent(this, tabId, tab));

    return true;
  }

  getActiveTabId(): string | null {
    return this.activeTabId;
  }

  getTab(tabId: string): UITab | undefined {
    return this.tabs.get(tabId);
  }

  getTabContent(tabId: string): UITabContent | undefined {
    return this.tabContents.get(tabId);
  }

  getAllTabs(): UITab[] {
    return Array.from(this.tabs.values());
  }

  getTabCount(): number {
    return this.tabs.size;
  }

  private calculateNextTabPosition(): Vector {
    const tabSpacing = this.tabbedConfig.tabSpacing ?? 2;
    const isHorizontal = this.tabbedConfig.tabPosition === "top" || this.tabbedConfig.tabPosition === "bottom";

    let offset = 0;
    this.tabs.forEach(tab => {
      if (isHorizontal) {
        offset += tab.width + tabSpacing;
      } else {
        offset += tab.height + tabSpacing;
      }
    });

    return isHorizontal ? vec(offset, 0) : vec(0, offset);
  }

  private repositionTabs(): void {
    const tabSpacing = this.tabbedConfig.tabSpacing ?? 2;
    const isHorizontal = this.tabbedConfig.tabPosition === "top" || this.tabbedConfig.tabPosition === "bottom";

    let offset = 0;
    this.tabs.forEach(tab => {
      if (isHorizontal) {
        tab.pos = vec(offset, 0);
        offset += tab.width + tabSpacing;
      } else {
        tab.pos = vec(0, offset);
        offset += tab.height + tabSpacing;
      }
    });
  }

  get contentArea() {
    const contentPadding = this.tabbedConfig.contentPadding ?? vec(10, 10);
    const tabHeight = this.tabbedConfig.tabHeight ?? 36;
    const borderWidth = this.tabbedConfig.borderWidth ?? 2;

    let availableWidth = this.tabbedConfig.width - contentPadding.x * 2 - borderWidth * 2;
    let availableHeight = this.tabbedConfig.height - contentPadding.y * 2 - borderWidth * 2;

    switch (this.tabbedConfig.tabPosition) {
      case "top":
      case "bottom":
        availableHeight -= tabHeight;
        break;
      case "left":
      case "right":
        availableWidth -= tabHeight;
        break;
    }

    return {
      x: 0,
      y: 0,
      width: availableWidth,
      height: availableHeight,
    };
  }
}

// UITab - Individual tab button
type UITabConfig = {
  id: string;
  label: string;
  icon?: Sprite;
  closeable?: boolean;
  pos: Vector;
  width: number;
  height: number;
  colors?: {
    activeBackground?: Color;
    inactiveBackground?: Color;
    hoverBackground?: Color;
    activeText?: Color;
    inactiveText?: Color;
    hoveredText?: Color; // ✅ ADD
    borderColor?: Color;
  };
  labelOffset?: Vector;
  isActive: boolean;
  isHorizontal: boolean;
};

class UITab extends ScreenElement {
  private config: UITabConfig;
  private isHovered: boolean = false;
  private label: Label;
  private closeButton?: ScreenElement;
  private tabGraphic: UITabGraphic;
  private isTabActive: boolean = false;
  private labelOffset: Vector = vec(0, 0);

  constructor(config: UITabConfig) {
    super({
      name: `Tab_${config.id}`,
      pos: config.pos,
      width: config.width,
      height: config.height,
    });
    this.labelOffset = config.labelOffset ?? vec(3, config.height / 2);
    this.config = config;
    this.isTabActive = config.isActive;

    // Create tab graphic
    this.tabGraphic = new UITabGraphic(vec(config.width, config.height), config);
    this.graphics.use(this.tabGraphic);

    // Create label
    const fontSize = 14;
    const font = new Font({
      family: "sans-serif",
      size: fontSize,
      unit: FontUnit.Px,
      color: config.colors?.inactiveText ?? Color.fromHex("#666666"),
    });

    this.label = new Label({
      text: config.label,
      pos: this.labelOffset,
      font: font,
    });
    this.addChild(this.label);

    // Create close button if closeable
    if (config.closeable) {
      this.createCloseButton();
    }

    // Set up pointer events
    this.on("pointerenter", () => {
      this.isHovered = true;
      this.updateLabelColor();
      this.updateGraphic();
    });

    this.on("pointerleave", () => {
      this.isHovered = false;
      this.updateLabelColor();
      this.updateGraphic();
    });

    this.updateGraphic();
  }

  private createCloseButton(): void {
    const buttonSize = 16;
    const margin = 6;

    this.closeButton = new ScreenElement({
      name: `CloseButton_${this.config.id}`,
      pos: vec(this.config.width - buttonSize - margin, (this.config.height - buttonSize) / 2),
      width: buttonSize,
      height: buttonSize,
    });

    const closeGraphic = new CloseButtonGraphic(vec(buttonSize, buttonSize));
    this.closeButton.graphics.use(closeGraphic);

    this.closeButton.on("pointerdown", evt => {
      evt.cancel();
      this.emit("close", evt);
    });

    this.addChild(this.closeButton);

    // Adjust label position to account for close button
    this.label.pos = vec((this.config.width - buttonSize - margin) / 2, this.config.height / 2);
  }

  setActive(active: boolean): void {
    this.isTabActive = active;
    this.updateGraphic();
    this.updateLabelColor();
  }

  private updateGraphic(): void {
    this.tabGraphic.setState(this.isTabActive, this.isHovered);
  }

  private updateLabelColor(): void {
    let color: Color;

    if (this.isTabActive) {
      color = this.config.colors?.activeText ?? Color.fromHex("#333333");
    } else if (this.isHovered) {
      color = this.config.colors?.hoveredText ?? this.config.colors?.inactiveText ?? Color.fromHex("#666666");
    } else {
      color = this.config.colors?.inactiveText ?? Color.fromHex("#666666");
    }

    this.label.font = new Font({
      family: "sans-serif",
      size: 14,
      unit: FontUnit.Px,
      color,
    });
  }

  get tabId(): string {
    return this.config.id;
  }
}

// UITabGraphic - Custom graphic for tab appearance
class UITabGraphic extends Graphic {
  private size: Vector;
  private config: UITabConfig;
  private isActive: boolean = false;
  private isHovered: boolean = false;
  cnv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  constructor(size: Vector, config: UITabConfig) {
    super({ width: size.x, height: size.y });
    this.size = size;
    this.config = config;
    this.cnv = document.createElement("canvas");
    this.cnv.width = this.size.x;
    this.cnv.height = this.size.y;
    this.ctx = this.cnv.getContext("2d")!;
  }

  clone(): UITabGraphic {
    return new UITabGraphic(this.size, this.config);
  }

  setState(isActive: boolean, isHovered: boolean): void {
    this.isActive = isActive;
    this.isHovered = isHovered;
  }

  protected _drawImage(ex: ExcaliburGraphicsContext, x: number, y: number): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.size.x, this.size.y);

    // Determine background color
    let bgColor: Color;

    if (this.isActive) {
      bgColor = this.config.colors?.activeBackground ?? Color.fromHex("#ffffff");
    } else if (this.isHovered) {
      bgColor = this.config.colors?.hoverBackground ?? Color.fromHex("#ececec");
    } else {
      bgColor = this.config.colors?.inactiveBackground ?? Color.fromHex("#e0e0e0");
    }

    // Draw background with rounded corners
    const radius = 8;
    ctx.fillStyle = bgColor.toString();
    ctx.beginPath();

    if (this.config.isHorizontal) {
      // Top rounded corners for horizontal tabs
      ctx.moveTo(0, this.size.y);
      ctx.lineTo(0, radius);
      ctx.arcTo(0, 0, radius, 0, radius);
      ctx.lineTo(this.size.x - radius, 0);
      ctx.arcTo(this.size.x, 0, this.size.x, radius, radius);
      ctx.lineTo(this.size.x, this.size.y);
      ctx.closePath();
    } else {
      // Left rounded corners for vertical tabs
      ctx.moveTo(this.size.x, 0);
      ctx.lineTo(radius, 0);
      ctx.arcTo(0, 0, 0, radius, radius);
      ctx.lineTo(0, this.size.y - radius);
      ctx.arcTo(0, this.size.y, radius, this.size.y, radius);
      ctx.lineTo(this.size.x, this.size.y);
      ctx.closePath();
    }

    ctx.fill();

    // Draw border
    const borderColor = this.config.colors?.borderColor ?? Color.fromHex("#cccccc");
    ctx.strokeStyle = borderColor.toString();
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw active indicator
    if (this.isActive) {
      ctx.fillStyle = Color.fromHex("#4a90e2").toString();
      if (this.config.isHorizontal) {
        ctx.fillRect(0, this.size.y - 3, this.size.x, 3);
      } else {
        ctx.fillRect(this.size.x - 3, 0, 3, this.size.y);
      }
    }

    this.cnv.setAttribute("forceUpload", "true");
    ex.drawImage(this.cnv, x, y);
  }
}

// Close button graphic
class CloseButtonGraphic extends Graphic {
  private size: Vector;
  cnv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  constructor(size: Vector) {
    super({ width: size.x, height: size.y });
    this.size = size;
    this.cnv = document.createElement("canvas");
    this.cnv.width = this.size.x;
    this.cnv.height = this.size.y;
    this.ctx = this.cnv.getContext("2d")!;
  }

  clone(): CloseButtonGraphic {
    return new CloseButtonGraphic(this.size);
  }

  protected _drawImage(ex: ExcaliburGraphicsContext, x: number, y: number): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.size.x, this.size.y);

    // Draw X
    const padding = 4;
    ctx.strokeStyle = Color.fromHex("#999999").toString();
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(this.size.x - padding, this.size.y - padding);
    ctx.moveTo(this.size.x - padding, padding);
    ctx.lineTo(padding, this.size.y - padding);
    ctx.stroke();

    this.cnv.setAttribute("forceUpload", "true");
    ex.drawImage(this.cnv, x, y);
  }
}

// UITabContent - Container for tab content
class UITabContent extends ScreenElement {
  private _tabId: string;
  private _lastGraphic: Graphic | null = null;

  constructor(config: { id: string; visible?: boolean }) {
    super({
      name: `TabContent_${config.id}`,
      pos: vec(0, 0),
    });
    this._tabId = config.id;
    this.graphics.isVisible = config.visible ?? false;
  }

  show(): void {
    this.graphics.isVisible = true;
    this.children.forEach(child => {
      if (child instanceof ScreenElement || child instanceof Actor) {
        child.graphics.isVisible = true;
      }
    });
  }

  hide(): void {
    this.graphics.isVisible = false;
    this._lastGraphic = this.graphics.current;
    this.children.forEach(child => {
      if (child instanceof ScreenElement || child instanceof Actor) {
        child.graphics.isVisible = false;
      }
    });
  }

  get isVisible(): boolean {
    return this.graphics.isVisible;
  }

  get tabId(): string {
    return this._tabId;
  }
}

// #region Events

export class TabChangedEvent extends GameEvent<UITabbedPanel> {
  constructor(
    public target: UITabbedPanel,
    public tabId: string,
    public tab: UITab,
  ) {
    super();
  }
}

export class TabAddedEvent extends GameEvent<UITabbedPanel> {
  constructor(
    public target: UITabbedPanel,
    public tabId: string,
    public tab: UITab,
  ) {
    super();
  }
}

export class TabRemovedEvent extends GameEvent<UITabbedPanel> {
  constructor(
    public target: UITabbedPanel,
    public tabId: string,
  ) {
    super();
  }
}

// #endregion Events
