package firmware

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
	"z-mapflow/internal/models"
	"z-mapflow/internal/project"
)

func writeBehavior(out *strings.Builder, b models.Behavior, resolve func(string) string) {
	if b.Target != "" {
		fmt.Fprintf(out, "\n&%s {\n", b.Target)
	} else {
		fmt.Fprintf(out, "    %s: %s {\n      compatible = %s;\n      #binding-cells = <%d>;\n      display-name = %s;\n", b.ID, b.ID, strconv.Quote(project.BehaviorCompatible(b)), project.BehaviorArity(b), strconv.Quote(b.Name))
	}
	if b.Kind == "hold-tap" || b.Kind == "tap-dance" {
		fmt.Fprintf(out, "      tapping-term-ms = <%d>;\n", b.TappingTermMs)
	}
	if b.Kind == "hold-tap" {
		fmt.Fprintf(out, "      quick-tap-ms = <%s>;\n      flavor = %s;\n      require-prior-idle-ms = <%s>;\n", numberCell(b.QuickTapMs), strconv.Quote(b.Flavor), numberCell(b.RequirePriorIdleMs))
		if len(b.HoldTriggerPositions) > 0 {
			out.WriteString("      hold-trigger-key-positions = <")
			for _, pos := range b.HoldTriggerPositions {
				fmt.Fprintf(out, "%d ", pos)
			}
			out.WriteString(">;\n")
		}
		for _, v := range []struct {
			name    string
			enabled bool
		}{{"retro-tap", b.RetroTap}, {"hold-while-undecided", b.HoldWhileUndecided}, {"hold-while-undecided-linger", b.HoldWhileUndecidedLinger}, {"hold-trigger-on-release", b.HoldTriggerOnRelease}} {
			if v.enabled {
				fmt.Fprintf(out, "      %s;\n", v.name)
			}
		}
	}
	if len(b.Bindings) > 0 {
		out.WriteString("      bindings = ")
		for i, code := range b.Bindings {
			if i > 0 {
				out.WriteString(", ")
			}
			if b.Kind == "hold-tap" || b.Kind == "sticky-key" {
				code = strings.Fields(code)[0]
			}
			fmt.Fprintf(out, "<%s>", resolve(code))
		}
		out.WriteString(";\n")
	}
	keys := []string{}
	for name := range b.Properties {
		keys = append(keys, name)
	}
	sort.Strings(keys)
	for _, name := range keys {
		value := resolve(b.Properties[name])
		if value == "/delete-property/" {
			fmt.Fprintf(out, "      /delete-property/ %s;\n", name)
			continue
		}
		if value == "" {
			fmt.Fprintf(out, "      %s;\n", name)
		} else {
			fmt.Fprintf(out, "      %s = %s;\n", name, value)
		}
	}
	out.WriteString(resolve(b.Children))
	out.WriteString("    };\n")
}

func numberCell(n int) string {
	if n < 0 {
		return fmt.Sprintf("(%d)", n)
	}
	return strconv.Itoa(n)
}
