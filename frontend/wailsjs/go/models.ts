export namespace models {
	
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
	export class SensorAction {
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
	        this.id = source["id"];
	        this.label = source["label"];
	        this.codeCW = source["codeCW"];
	        this.codeCCW = source["codeCCW"];
	        this.codeClick = source["codeClick"];
	        this.clickKeymapIndex = source["clickKeymapIndex"];
	    }
	}
	export class LayerData {
	    name: string;
	    keys: KeyAction[];
	    sensors: SensorAction[];
	
	    static createFrom(source: any = {}) {
	        return new LayerData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
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
	    name: string;
	    layers: LayerData[];
	
	    static createFrom(source: any = {}) {
	        return new KeyboardLayout(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.layers = this.convertValues(source["layers"], LayerData);
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

