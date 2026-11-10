export namespace firmware {
	
	export class Artifact {
	    targetId: string;
	    name: string;
	    size: number;
	    sha256: string;
	
	    static createFrom(source: any = {}) {
	        return new Artifact(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.targetId = source["targetId"];
	        this.name = source["name"];
	        this.size = source["size"];
	        this.sha256 = source["sha256"];
	    }
	}
	export class Build {
	    id: string;
	    revision: string;
	    pluginId: string;
	    variantId: string;
	    status: string;
	    stage: string;
	    startedAt: string;
	    finishedAt: string;
	    error: string;
	    logs: string[];
	    artifacts: Artifact[];
	
	    static createFrom(source: any = {}) {
	        return new Build(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.revision = source["revision"];
	        this.pluginId = source["pluginId"];
	        this.variantId = source["variantId"];
	        this.status = source["status"];
	        this.stage = source["stage"];
	        this.startedAt = source["startedAt"];
	        this.finishedAt = source["finishedAt"];
	        this.error = source["error"];
	        this.logs = source["logs"];
	        this.artifacts = this.convertValues(source["artifacts"], Artifact);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SourceFile {
	    name: string;
	    content: string;
	
	    static createFrom(source: any = {}) {
	        return new SourceFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.content = source["content"];
	    }
	}

}

export namespace flash {
	
	export class Result {
	    status: string;
	    detail: string;
	
	    static createFrom(source: any = {}) {
	        return new Result(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.detail = source["detail"];
	    }
	}
	export class Volume {
	    path: string;
	    name: string;
	    board: string;
	
	    static createFrom(source: any = {}) {
	        return new Volume(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	        this.board = source["board"];
	    }
	}

}

export namespace models {
	
	export class Behavior {
	    children?: string;
	    retroTap?: boolean;
	    holdWhileUndecided?: boolean;
	    holdWhileUndecidedLinger?: boolean;
	    parameterCount?: number;
	    parameters?: string[];
	    compatible?: string;
	    target?: string;
	    properties?: Record<string, string>;
	    requirePriorIdleMs: number;
	    holdTriggerPositions: number[];
	    holdTriggerOnRelease: boolean;
	    id: string;
	    name: string;
	    kind: string;
	    bindings: string[];
	    tappingTermMs: number;
	    quickTapMs: number;
	    flavor: string;
	
	    static createFrom(source: any = {}) {
	        return new Behavior(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.children = source["children"];
	        this.retroTap = source["retroTap"];
	        this.holdWhileUndecided = source["holdWhileUndecided"];
	        this.holdWhileUndecidedLinger = source["holdWhileUndecidedLinger"];
	        this.parameterCount = source["parameterCount"];
	        this.parameters = source["parameters"];
	        this.compatible = source["compatible"];
	        this.target = source["target"];
	        this.properties = source["properties"];
	        this.requirePriorIdleMs = source["requirePriorIdleMs"];
	        this.holdTriggerPositions = source["holdTriggerPositions"];
	        this.holdTriggerOnRelease = source["holdTriggerOnRelease"];
	        this.id = source["id"];
	        this.name = source["name"];
	        this.kind = source["kind"];
	        this.bindings = source["bindings"];
	        this.tappingTermMs = source["tappingTermMs"];
	        this.quickTapMs = source["quickTapMs"];
	        this.flavor = source["flavor"];
	    }
	}
	export class BuildTarget {
	    targetId: string;
	    snippets?: string[];
	    cmakeArgs?: string[];
	
	    static createFrom(source: any = {}) {
	        return new BuildTarget(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.targetId = source["targetId"];
	        this.snippets = source["snippets"];
	        this.cmakeArgs = source["cmakeArgs"];
	    }
	}
	export class Combo {
	    requirePriorIdleMs?: number;
	    id: string;
	    name: string;
	    positions: number[];
	    binding: string;
	    layerIds: string[];
	    timeoutMs: number;
	    slowRelease: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Combo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.requirePriorIdleMs = source["requirePriorIdleMs"];
	        this.id = source["id"];
	        this.name = source["name"];
	        this.positions = source["positions"];
	        this.binding = source["binding"];
	        this.layerIds = source["layerIds"];
	        this.timeoutMs = source["timeoutMs"];
	        this.slowRelease = source["slowRelease"];
	    }
	}
	export class ConditionalLayer {
	    id: string;
	    name: string;
	    ifLayerIds: string[];
	    thenLayerId: string;
	
	    static createFrom(source: any = {}) {
	        return new ConditionalLayer(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.ifLayerIds = source["ifLayerIds"];
	        this.thenLayerId = source["thenLayerId"];
	    }
	}
	export class HeaderBundle {
	    name: string;
	    files: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new HeaderBundle(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.files = source["files"];
	    }
	}
	export class HoldTapSettings {
	    tappingTermMs: number;
	    quickTapMs: number;
	    flavor: string;
	
	    static createFrom(source: any = {}) {
	        return new HoldTapSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tappingTermMs = source["tappingTermMs"];
	        this.quickTapMs = source["quickTapMs"];
	        this.flavor = source["flavor"];
	    }
	}
	export class InputProcessorChain {
	    id: string;
	    listener: string;
	    layerIds: string[];
	    bindings: string[];
	    processNext: boolean;
	
	    static createFrom(source: any = {}) {
	        return new InputProcessorChain(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.listener = source["listener"];
	        this.layerIds = source["layerIds"];
	        this.bindings = source["bindings"];
	        this.processNext = source["processNext"];
	    }
	}
	export class KeyAction {
	    keymapIndex: number;
	    row: number;
	    col: number;
	    code: string;
	    label: string;
	
	    static createFrom(source: any = {}) {
	        return new KeyAction(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.keymapIndex = source["keymapIndex"];
	        this.row = source["row"];
	        this.col = source["col"];
	        this.code = source["code"];
	        this.label = source["label"];
	    }
	}
	export class MacroStep {
	    kind: string;
	    binding: string;
	    durationMs: number;
	
	    static createFrom(source: any = {}) {
	        return new MacroStep(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.binding = source["binding"];
	        this.durationMs = source["durationMs"];
	    }
	}
	export class Macro {
	    parameterCount?: number;
	    parameters?: string[];
	    id: string;
	    name: string;
	    tapMs: number;
	    waitMs: number;
	    steps: MacroStep[];
	
	    static createFrom(source: any = {}) {
	        return new Macro(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.parameterCount = source["parameterCount"];
	        this.parameters = source["parameters"];
	        this.id = source["id"];
	        this.name = source["name"];
	        this.tapMs = source["tapMs"];
	        this.waitMs = source["waitMs"];
	        this.steps = this.convertValues(source["steps"], MacroStep);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SensorAction {
	    inherited?: boolean;
	    tapMs?: number;
	    triggersPerRotation?: number;
	    id: string;
	    label: string;
	    codeCW: string;
	    codeCCW: string;
	    codeClick: string;
	    clickKeymapIndex: number;
	
	    static createFrom(source: any = {}) {
	        return new SensorAction(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.inherited = source["inherited"];
	        this.tapMs = source["tapMs"];
	        this.triggersPerRotation = source["triggersPerRotation"];
	        this.id = source["id"];
	        this.label = source["label"];
	        this.codeCW = source["codeCW"];
	        this.codeCCW = source["codeCCW"];
	        this.codeClick = source["codeClick"];
	        this.clickKeymapIndex = source["clickKeymapIndex"];
	    }
	}
	export class LayerData {
	    id: string;
	    name: string;
	    keys: KeyAction[];
	    sensors: SensorAction[];
	
	    static createFrom(source: any = {}) {
	        return new LayerData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.keys = this.convertValues(source["keys"], KeyAction);
	        this.sensors = this.convertValues(source["sensors"], SensorAction);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class KeyboardLayout {
	    inputProcessors?: InputProcessorChain[];
	    conditionalLayers?: ConditionalLayer[];
	    name: string;
	    layers: LayerData[];
	    macros: Macro[];
	    combos: Combo[];
	    behaviors: Behavior[];
	
	    static createFrom(source: any = {}) {
	        return new KeyboardLayout(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.inputProcessors = this.convertValues(source["inputProcessors"], InputProcessorChain);
	        this.conditionalLayers = this.convertValues(source["conditionalLayers"], ConditionalLayer);
	        this.name = source["name"];
	        this.layers = this.convertValues(source["layers"], LayerData);
	        this.macros = this.convertValues(source["macros"], Macro);
	        this.combos = this.convertValues(source["combos"], Combo);
	        this.behaviors = this.convertValues(source["behaviors"], Behavior);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	export class Module {
	    name: string;
	    url: string;
	    revision: string;
	    import: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Module(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.url = source["url"];
	        this.revision = source["revision"];
	        this.import = source["import"];
	    }
	}
	export class Options {
	    rgbUnderglow?: boolean;
	    backlight?: boolean;
	    softOff?: boolean;
	    modTap?: HoldTapSettings;
	    layerTap?: HoldTapSettings;
	    locale: string;
	    display: boolean;
	    pointing: boolean;
	    tappingTermMs: number;
	    quickTapMs: number;
	    flavor: string;
	    bluetoothProfiles: number;
	    sleep: boolean;
	    sleepTimeoutMs: number;
	
	    static createFrom(source: any = {}) {
	        return new Options(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.rgbUnderglow = source["rgbUnderglow"];
	        this.backlight = source["backlight"];
	        this.softOff = source["softOff"];
	        this.modTap = this.convertValues(source["modTap"], HoldTapSettings);
	        this.layerTap = this.convertValues(source["layerTap"], HoldTapSettings);
	        this.locale = source["locale"];
	        this.display = source["display"];
	        this.pointing = source["pointing"];
	        this.tappingTermMs = source["tappingTermMs"];
	        this.quickTapMs = source["quickTapMs"];
	        this.flavor = source["flavor"];
	        this.bluetoothProfiles = source["bluetoothProfiles"];
	        this.sleep = source["sleep"];
	        this.sleepTimeoutMs = source["sleepTimeoutMs"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Target {
	    role?: string;
	    id: string;
	    name: string;
	    board: string;
	    shield: string;
	    artifact: string;
	
	    static createFrom(source: any = {}) {
	        return new Target(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.role = source["role"];
	        this.id = source["id"];
	        this.name = source["name"];
	        this.board = source["board"];
	        this.shield = source["shield"];
	        this.artifact = source["artifact"];
	    }
	}
	export class Variant {
	    features?: string[];
	    zmkRevision: string;
	    buildImage: string;
	    id: string;
	    name: string;
	    targets: Target[];
	    bootloaderBoards: string[];
	    uf2Family: number;
	    instructions: string;
	
	    static createFrom(source: any = {}) {
	        return new Variant(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.features = source["features"];
	        this.zmkRevision = source["zmkRevision"];
	        this.buildImage = source["buildImage"];
	        this.id = source["id"];
	        this.name = source["name"];
	        this.targets = this.convertValues(source["targets"], Target);
	        this.bootloaderBoards = source["bootloaderBoards"];
	        this.uf2Family = source["uf2Family"];
	        this.instructions = source["instructions"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Position {
	    id: string;
	    keymapIndex: number;
	    x: number;
	    y: number;
	    rotation: number;
	    width: number;
	    height: number;
	    sensorId: string;
	
	    static createFrom(source: any = {}) {
	        return new Position(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.keymapIndex = source["keymapIndex"];
	        this.x = source["x"];
	        this.y = source["y"];
	        this.rotation = source["rotation"];
	        this.width = source["width"];
	        this.height = source["height"];
	        this.sensorId = source["sensorId"];
	    }
	}
	export class PluginAction {
	    name: string;
	    code: string;
	
	    static createFrom(source: any = {}) {
	        return new PluginAction(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.code = source["code"];
	    }
	}
	export class Plugin {
	    files: Record<string, string>;
	    modules: Module[];
	    bindingArities: Record<string, number>;
	    actions: PluginAction[];
	    contractVersion: number;
	    id: string;
	    version: string;
	    name: string;
	    keymapName: string;
	    keyCount: number;
	    width: number;
	    height: number;
	    positions: Position[];
	    sensors: SensorAction[];
	    variants: Variant[];
	    zmkRevision: string;
	    buildImage: string;
	    config: string;
	    overlay: string;
	    capabilities: string[];
	
	    static createFrom(source: any = {}) {
	        return new Plugin(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.files = source["files"];
	        this.modules = this.convertValues(source["modules"], Module);
	        this.bindingArities = source["bindingArities"];
	        this.actions = this.convertValues(source["actions"], PluginAction);
	        this.contractVersion = source["contractVersion"];
	        this.id = source["id"];
	        this.version = source["version"];
	        this.name = source["name"];
	        this.keymapName = source["keymapName"];
	        this.keyCount = source["keyCount"];
	        this.width = source["width"];
	        this.height = source["height"];
	        this.positions = this.convertValues(source["positions"], Position);
	        this.sensors = this.convertValues(source["sensors"], SensorAction);
	        this.variants = this.convertValues(source["variants"], Variant);
	        this.zmkRevision = source["zmkRevision"];
	        this.buildImage = source["buildImage"];
	        this.config = source["config"];
	        this.overlay = source["overlay"];
	        this.capabilities = source["capabilities"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	export class Project {
	    schemaVersion: number;
	    pluginId: string;
	    pluginVersion: string;
	    variantId: string;
	    revision: string;
	    savedAt: string;
	    layout: KeyboardLayout;
	    options: Options;
	    preamble?: string;
	    extraDts?: string;
	    extraConfig?: string;
	    headers?: Record<string, string>;
	    buildTargets?: BuildTarget[];
	
	    static createFrom(source: any = {}) {
	        return new Project(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.schemaVersion = source["schemaVersion"];
	        this.pluginId = source["pluginId"];
	        this.pluginVersion = source["pluginVersion"];
	        this.variantId = source["variantId"];
	        this.revision = source["revision"];
	        this.savedAt = source["savedAt"];
	        this.layout = this.convertValues(source["layout"], KeyboardLayout);
	        this.options = this.convertValues(source["options"], Options);
	        this.preamble = source["preamble"];
	        this.extraDts = source["extraDts"];
	        this.extraConfig = source["extraConfig"];
	        this.headers = source["headers"];
	        this.buildTargets = this.convertValues(source["buildTargets"], BuildTarget);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class Session {
	    project: Project;
	    plugin: Plugin;
	    hasSaved: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Session(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.project = this.convertValues(source["project"], Project);
	        this.plugin = this.convertValues(source["plugin"], Plugin);
	        this.hasSaved = source["hasSaved"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	

}

export namespace updates {
	
	export class Info {
	    currentVersion: string;
	    latestVersion: string;
	    available: boolean;
	    supported: boolean;
	    releaseUrl: string;
	    notes: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Info(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentVersion = source["currentVersion"];
	        this.latestVersion = source["latestVersion"];
	        this.available = source["available"];
	        this.supported = source["supported"];
	        this.releaseUrl = source["releaseUrl"];
	        this.notes = source["notes"];
	        this.message = source["message"];
	    }
	}
	export class Progress {
	    stage: string;
	    downloaded: number;
	    total: number;
	
	    static createFrom(source: any = {}) {
	        return new Progress(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.stage = source["stage"];
	        this.downloaded = source["downloaded"];
	        this.total = source["total"];
	    }
	}

}

export namespace version {
	
	export class Info {
	    version: string;
	    commit: string;
	
	    static createFrom(source: any = {}) {
	        return new Info(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.commit = source["commit"];
	    }
	}

}

