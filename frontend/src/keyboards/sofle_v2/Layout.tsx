import { ILayer } from "../../types/keyboard";
import { KeyboardBuilder } from "../../components/KeyboardBuilder";

interface SofleLayoutProps {
    layer: ILayer;
}

export function SofleLayout({ layer }: SofleLayoutProps) {
    // Pegamos a metade esquerda e excluímos a tecla 24 (Clique do Encoder Esquerdo)
    const leftKeys = layer.keys.filter((k) => k.keymapIndex < 29 && k.keymapIndex !== 24);

    // Pegamos a metade direita e excluímos a tecla 57 (Clique do Encoder Direito)
    const rightKeys = layer.keys.filter((k) => k.keymapIndex >= 29 && k.keymapIndex !== 57);

    const leftConfig = {
        offsets: [2, 2, 1, 0, 1, 2],
        thumbRowStartIndex: 4,
        keys: leftKeys,
    };

    const rightConfig = {
        offsets: [2, 1, 0, 1, 2, 2],
        thumbRowStartIndex: 9,
        keys: rightKeys,
    };

    return <KeyboardBuilder left={leftConfig} right={rightConfig} sensors={layer.sensors} />;
}
