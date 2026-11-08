package firmware

import (
	"encoding/binary"
	"fmt"
	"io"
	"os"
)

func ValidateUF2(path string, family uint32) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		return err
	}
	if info.Size() == 0 || info.Size()%512 != 0 {
		return fmt.Errorf("arquivo UF2 incompleto")
	}
	count := uint32(info.Size() / 512)
	seen := map[uint32]bool{}
	buf := make([]byte, 512)
	for block := uint32(0); block < count; block++ {
		if _, err = io.ReadFull(f, buf); err != nil {
			return err
		}
		word := func(offset int) uint32 { return binary.LittleEndian.Uint32(buf[offset : offset+4]) }
		if word(0) != 0x0A324655 || word(4) != 0x9E5D5157 || word(508) != 0x0AB16F30 || word(16) > 476 || word(24) != count || word(20) >= count || seen[word(20)] {
			return fmt.Errorf("estrutura UF2 inválida")
		}
		seen[word(20)] = true
		if family != 0 && (word(8)&0x2000 == 0 || word(28) != family) {
			return fmt.Errorf("firmware não corresponde à família da controladora")
		}
	}
	return nil
}
